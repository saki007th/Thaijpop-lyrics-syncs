import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ALLOWED_EMAILS = ["sashikiwa@gmail.com", "panupong.bb27115@gmail.com"]; 

const firebaseConfig = {
    apiKey: "AIzaSyDV-gefPFqCmAvYmrSXeb5W1JUKf4Ev50Q",
    authDomain: "musix-syn.firebaseapp.com",
    projectId: "musix-syn",
    storageBucket: "musix-syn.firebasestorage.app",
    messagingSenderId: "154980084057",
    appId: "1:154980084057:web:e0af2ed833cb127f3b8448",
    measurementId: "G-2NCK3PQEFV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const songsCollection = collection(db, 'songs');

window.songs = [];
window.currentLyricsArray = [];
window.currentLyricIndex = -1;
window.editingSongId = null;
window.currentSongId = null;
window.ytPlayer = null;
window.syncInterval = null;
window.isLoggedIn = false; 
window.isAdmin = false;
window.isYTApiReady = false;
window.currentFilter = 'All'; 

// ==========================================
// 🪟 Window Manager (ระบบจัดการหน้าต่าง OS)
// ==========================================
window.wm = {
    libWin: null, playerWin: null, lyricsWin: null, settingsWin: null, addWin: null,

    openLibrary: function() {
        if (this.libWin) { this.libWin.focus(); return; }
        const mountObj = document.getElementById("content-library");
        this.libWin = new WinBox("🏠 คลังเพลงของฉัน", {
            mount: mountObj, width: "80%", height: "80%", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.libWin = null; }
        });
        window.renderSongList();
    },
    openSettings: function() {
        if (this.settingsWin) { this.settingsWin.focus(); return; }
        this.settingsWin = new WinBox("⚙️ การตั้งค่า", {
            mount: document.getElementById("content-settings"), width: "350px", height: "450px", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.settingsWin = null; }
        });
    },
    openPlayer: function(title) {
        if (this.playerWin) { this.playerWin.setTitle("🎥 " + title); this.playerWin.focus(); return; }
        this.playerWin = new WinBox("🎥 " + title, {
            mount: document.getElementById("content-player"), width: "500px", height: "320px", x: "20px", y: "80px", class: ["wb-dark", "no-min"],
            onclose: () => { 
                this.playerWin = null;
                if (window.ytPlayer && typeof window.ytPlayer.pauseVideo === 'function') window.ytPlayer.pauseVideo();
            }
        });
    },
    openLyrics: function(title) {
        if (this.lyricsWin) { this.lyricsWin.setTitle("📝 " + title); this.lyricsWin.focus(); return; }
        this.lyricsWin = new WinBox("📝 " + title, {
            mount: document.getElementById("content-lyrics"), width: "500px", height: "80%", x: "right", y: "center", class: ["wb-dark"],
            onclose: () => { this.lyricsWin = null; }
        });
        
        // เช็คโหมด Admin 
        document.getElementById('timestampEditorSection').style.display = window.isAdmin ? 'block' : 'none';
        document.getElementById('btnResetSync').style.display = window.isAdmin ? 'block' : 'none';
        document.getElementById('lyricControlBtnGroup').style.display = window.isAdmin ? 'flex' : 'none';
    },
    openAdd: function(title) {
        if (this.addWin) { this.addWin.setTitle(title); this.addWin.focus(); return; }
        this.addWin = new WinBox(title, {
            mount: document.getElementById("content-add"), width: "450px", height: "650px", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.addWin = null; }
        });
    }
};

// ==========================================
// ฟังก์ชันปิด Dropdown ของ Admin
// ==========================================
document.addEventListener('click', function(e) {
    if (!e.target.closest('.ts-singer-dropdown')) {
        document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    }
});

window.getSingersList = function(artistStr) {
    if (!artistStr) return [];
    let parts = [];
    if (artistStr.includes('[')) {
        const matches = artistStr.match(/\[(.*?)\]/g);
        if (matches) parts = matches.map(m => m.replace(/[\[\]]/g, ''));
        else parts = [artistStr];
    } else { parts = artistStr.split(/[,/&]+/); }
    return parts.map(p => p.trim()).filter(p => p);
};

window.setTheme = function(themeName) {
    const themes = {
        'default': 'linear-gradient(120deg, #00d2ff, #9b51e0, #ff2a85, #ff8c00, #00d2ff)',
        'ocean': 'linear-gradient(120deg, #2193b0, #6dd5ed, #2193b0, #6dd5ed)'
    };
    document.documentElement.style.setProperty('--theme-glow', themes[themeName] || themes['default']);
    localStorage.setItem('selectedTheme', themeName);
}
window.setTheme(localStorage.getItem('selectedTheme') || 'default');

window.onYouTubeIframeAPIReady = function() { window.isYTApiReady = true; };
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

// ==========================================
// ระบบ Login & ดึงข้อมูล
// ==========================================
onAuthStateChanged(auth, (user) => {
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
    
    document.getElementById('btnHeaderLogout').style.display = window.isLoggedIn ? 'block' : 'none';
    document.getElementById('btnHeaderLogin').style.display = window.isLoggedIn ? 'none' : 'block';
    document.getElementById('btnAddSong').style.display = window.isAdmin ? 'block' : 'none';
    
    fetchSongs(); 
});

window.loginWithGoogle = async function() {
    try { await signInWithPopup(auth, provider); } catch (e) { alert("เข้าสู่ระบบไม่สำเร็จ"); }
}
window.logout = async function() {
    if(confirm('ต้องการออกจากระบบใช่หรือไม่?')) { await signOut(auth); }
}

async function fetchSongs() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        const querySnapshot = await getDocs(songsCollection);
        window.songs = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            window.songs.push({
                id: doc.id, title: data.title, artist: data.artist, audioPath: data.audioPath,
                lyrics: data.lyrics, timestamps: data.timestamps || [], singers: data.singers || [] 
            });
        });
        document.getElementById('loadingOverlay').style.display = 'none';
        
        const urlParams = new URLSearchParams(window.location.search);
        const songIdFromUrl = urlParams.get('song');
        if (songIdFromUrl) {
            const foundSong = window.songs.find(s => s.id === songIdFromUrl);
            if (foundSong) { window.playSong(foundSong.id); return; }
        }
        window.wm.openLibrary(); // เปิดคลังเพลงเป็นหน้าต่างแรกสุด
    } catch (error) {
        console.error(error); alert("เชื่อมต่อฐานข้อมูลไม่สำเร็จ");
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

window.extractYouTubeID = function(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

// ==========================================
// ระบบเพิ่ม/แก้ไขเพลง
// ==========================================
window.openAddView = function() {
    if (!window.isAdmin) return;
    window.editingSongId = null;
    document.getElementById('inputTitle').value = '';
    document.getElementById('inputArtist').value = '';
    document.getElementById('inputAudio').value = '';
    document.getElementById('inputLyrics').value = '';
    window.wm.openAdd('✨ เพิ่มเพลงใหม่');
}

window.editSong = function(id) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === id);
    if (!song) return;
    window.editingSongId = id;
    document.getElementById('inputTitle').value = song.title;
    document.getElementById('inputArtist').value = song.artist || '';
    document.getElementById('inputAudio').value = song.audioPath;
    document.getElementById('inputLyrics').value = song.lyrics;
    window.wm.openAdd('✏️ แก้ไขเพลง');
}

window.saveSong = async function() {
    if (!window.isAdmin) return;
    const title = document.getElementById('inputTitle').value.trim();
    const artist = document.getElementById('inputArtist').value.trim();
    const audioPath = document.getElementById('inputAudio').value.trim();
    const lyrics = document.getElementById('inputLyrics').value.trim();
    const btnSave = document.getElementById('btnSave');

    if (!title || !lyrics || !window.extractYouTubeID(audioPath)) { alert("ข้อมูลไม่ครบถ้วน หรือลิงก์ YouTube ผิด"); return; }
    btnSave.disabled = true; btnSave.innerText = "กำลังบันทึก...";

    try {
        if (window.editingSongId) {
            await updateDoc(doc(db, "songs", window.editingSongId), { title, artist, audioPath, lyrics });
        } else {
            await addDoc(songsCollection, { title, artist, audioPath, lyrics, timestamps: [], singers: [] });
        }
        await fetchSongs();
        if(window.wm.addWin) window.wm.addWin.close(); // ปิดหน้าต่างบันทึก
        if(window.wm.libWin) window.renderSongList(); // รีเฟรชคลังเพลง
    } catch (e) { console.error(e); alert("บันทึกไม่สำเร็จ"); } 
    finally { btnSave.disabled = false; btnSave.innerText = "💾 บันทึกเพลง"; window.editingSongId = null; }
}

window.deleteSong = async function(id) {
    if (!window.isAdmin) return;
    if(confirm('ต้องการลบเพลงนี้ใช่หรือไม่?')) {
        try { await deleteDoc(doc(db, "songs", id)); await fetchSongs(); if(window.wm.libWin) window.renderSongList(); } 
        catch(e) { console.error(e); }
    }
}

// ==========================================
// ระบบค้นหาและ Filter
// ==========================================
window.filterByArtist = function(artistName) {
    window.currentFilter = artistName;
    window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), artistName);
}
window.filterSongs = function() {
    window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), window.currentFilter);
}

window.renderSongList = function(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList');
    const chipContainer = document.getElementById('artistChips');
    if(!listContainer) return;
    listContainer.innerHTML = '';

    if (chipContainer) {
        let artistSet = new Set();
        window.songs.forEach(s => window.getSingersList(s.artist).forEach(n => artistSet.add(n)));
        const artists = ['All', ...Array.from(artistSet)];
        chipContainer.innerHTML = artists.map(a => 
            `<button class="chip ${artistFilter === a ? 'active' : ''}" onclick="filterByArtist('${a}')">${a === 'All' ? 'ทั้งหมด' : a}</button>`
        ).join('');
    }

    const filtered = window.songs.filter(song => {
        const q = query.toLowerCase(); const artist = song.artist || '';
        const searchMatch = (song.title && song.title.toLowerCase().includes(q)) || artist.toLowerCase().includes(q);
        const filterMatch = (artistFilter === 'All' || artist.includes(artistFilter));
        return searchMatch && filterMatch;
    });

    filtered.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-item';
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        
        let actionsHtml = window.isAdmin ? `<button class="btn-secondary" onclick="editSong('${song.id}')">✏️</button><button class="btn-secondary" style="color:#ff3b30;" onclick="deleteSong('${song.id}')">ลบ</button>` : '';
        item.innerHTML = `
            <img src="${thumbUrl}" onerror="this.style.display='none'">
            <div>
                <div class="song-title">${song.title}</div>
                <div class="song-artist">🎤 ${song.artist || '-'}</div>
            </div>
            <div class="song-actions">
                <button class="btn-primary" onclick="playSong('${song.id}')">▶ เล่น</button>
                ${actionsHtml}
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// ==========================================
// ระบบเล่นเพลง & เนื้อเพลง
// ==========================================
window.renderLyricsToContainer = function() {
    const container = document.getElementById('lyricsContainer');
    if(!container) return;
    container.innerHTML = ''; 
    if (window.currentLyricsArray.length === 0) { container.innerHTML = 'ไม่มีเนื้อเพลง'; return; }

    const song = window.songs.find(s => s.id === window.currentSongId);
    window.currentLyricsArray.forEach((lyric, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'lyric-line';
        lineDiv.id = `lyric-line-${index}`;

        const linesHtml = lyric.split('\n').map((l, i) => `<div class="lang-${i}">${l}</div>`).join('');
        const singerString = (song && song.singers && song.singers[index]) ? song.singers[index] : null;

        if (singerString) {
            const badgesHtml = singerString.split(',').filter(s=>s.trim()).map(s => `<span class="singer-badge">${s.trim()}</span>`).join('');
            lineDiv.innerHTML = `<div class="singer-badges">${badgesHtml}</div>${linesHtml}`;
        } else {
            lineDiv.innerHTML = linesHtml;
        }
        container.appendChild(lineDiv);
    });
}

window.playSong = function(id) {
    window.currentSongId = id;
    const song = window.songs.find(s => s.id === id);
    if (!song) return;

    window.currentLyricsArray = song.lyrics.split(/\n\s*\n/);
    window.currentLyricIndex = -1;
    
    // 🔴 เรียกหน้าต่างขึ้นมา
    window.wm.openPlayer(song.title);
    window.wm.openLyrics(song.title);

    window.renderTimestampEditor();
    window.renderLyricsToContainer(); 
    window.updateLyricDisplay();

    const videoId = window.extractYouTubeID(song.audioPath);
    const bgEl = document.getElementById('dynamic-bg');
    if (bgEl && videoId) {
        bgEl.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`;
        bgEl.classList.add('active');
    }
    
    if (window.ytPlayer) {
        if (typeof window.ytPlayer.loadVideoById === 'function') window.ytPlayer.loadVideoById(videoId);
    } else {
        if (window.isYTApiReady || (window.YT && window.YT.Player)) {
            window.ytPlayer = new YT.Player('youtubePlayer', {
                height: '100%', width: '100%', videoId: videoId,
                playerVars: { 'playsinline': 1, 'controls': 1 },
                events: { 'onStateChange': window.onPlayerStateChange }
            });
        }
    }

    clearInterval(window.syncInterval);
    window.syncInterval = setInterval(() => {
        if (!window.ytPlayer || typeof window.ytPlayer.getCurrentTime !== 'function') return;
        const currentSong = window.songs.find(s => s.id === window.currentSongId);
        if (!currentSong || !currentSong.timestamps) return;

        const currentTime = window.ytPlayer.getCurrentTime();
        if (currentTime === undefined || currentTime === 0) return;

        const nextIndex = window.currentLyricIndex + 1;
        if (nextIndex <= window.currentLyricsArray.length) {
            const targetTime = currentSong.timestamps[nextIndex];
            if (targetTime != null && currentTime >= targetTime) window.nextLyric(true); 
        }
    }, 100); 
}

// ==========================================
// โค้ด Admin: แก้ไขเวลา & เนื้อเพลง
// ==========================================
window.saveTimestampsToFirebase = async function(updateLyricsText = false) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (song) {
        if (updateLyricsText) song.lyrics = window.currentLyricsArray.join('\n\n');
        const count = window.currentLyricsArray.length;
        const safeTs = Array.from({length: count}, (_, i) => (song.timestamps && song.timestamps[i] != null) ? song.timestamps[i] : null);
        const safeSg = Array.from({length: count}, (_, i) => (song.singers && song.singers[i] != null) ? song.singers[i] : "");

        const payload = { timestamps: safeTs, singers: safeSg };
        if (updateLyricsText) payload.lyrics = song.lyrics; 

        await updateDoc(doc(db, "songs", window.currentSongId), payload);
        song.timestamps = safeTs; song.singers = safeSg;
        if (updateLyricsText) { window.renderLyricsToContainer(); window.updateLyricDisplay(); }
    }
}

window.renderTimestampEditor = function() {
    const container = document.getElementById('timestampList');
    if(!container) return;
    container.innerHTML = '';
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song) return;

    window.currentLyricsArray.forEach((lyric, index) => {
        const row = document.createElement('div');
        row.style.background = 'rgba(255,255,255,0.05)'; row.style.padding = '10px'; row.style.marginBottom = '10px'; row.style.borderRadius = '8px';

        const lyricEditor = document.createElement('textarea');
        lyricEditor.value = lyric; lyricEditor.style.height = '60px'; lyricEditor.style.marginBottom = '10px';
        if (!window.isAdmin) { lyricEditor.readOnly = true; } 
        else { lyricEditor.onchange = (e) => { window.currentLyricsArray[index] = e.target.value.trim(); window.saveTimestampsToFirebase(true); }; }
        
        row.appendChild(lyricEditor);
        container.appendChild(row);
    });
}

window.updateLyricDisplay = function() {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;
    container.querySelectorAll('.lyric-line').forEach(line => line.classList.remove('active'));

    if (window.currentLyricIndex >= 0 && window.currentLyricIndex < window.currentLyricsArray.length) {
        const activeLine = document.getElementById(`lyric-line-${window.currentLyricIndex}`);
        if (activeLine) {
            activeLine.classList.add('active'); 
            activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }
}

window.nextLyric = function(isAuto = false) {
    if (window.currentLyricIndex < window.currentLyricsArray.length) {
        window.currentLyricIndex++;
        window.updateLyricDisplay();
        if (!isAuto && window.isAdmin && window.currentSongId && window.ytPlayer) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) {
                if (!song.timestamps) song.timestamps = [];
                song.timestamps[window.currentLyricIndex] = window.ytPlayer.getCurrentTime();
                window.saveTimestampsToFirebase();
            }
        }
    }
}

window.prevLyric = function() {
    if (window.currentLyricIndex > -1) {
        if (window.isAdmin && window.currentSongId) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song && song.timestamps) { song.timestamps[window.currentLyricIndex] = null; window.saveTimestampsToFirebase(); }
        }
        window.currentLyricIndex--; window.updateLyricDisplay();
    }
}

window.resetSync = function() {
    if (!window.isAdmin) return;
    if(confirm('ล้างเวลาทั้งหมด?')) {
        const song = window.songs.find(s => s.id === window.currentSongId);
        if (song) {
            song.timestamps = []; song.singers = []; window.saveTimestampsToFirebase();
            window.currentLyricIndex = -1; window.renderTimestampEditor(); window.updateLyricDisplay();
        }
    }
}

window.toggleLang = function(langIndex) {
    const container = document.getElementById('lyricsContainer');
    if (!container) return;
    if (event.target.checked) container.classList.remove(`hide-lang-${langIndex}`);
    else container.classList.add(`hide-lang-${langIndex}`);
}

window.onPlayerStateChange = function(event) {
    if (event.data === 0) {
        const idx = window.songs.findIndex(s => s.id === window.currentSongId);
        if (idx !== -1 && idx + 1 < window.songs.length) window.playSong(window.songs[idx + 1].id);
    }
};