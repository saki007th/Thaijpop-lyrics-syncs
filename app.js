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

window.songs = []; window.currentLyricsArray = []; window.currentLyricIndex = -1;
window.editingSongId = null; window.currentSongId = null; window.ytPlayer = null;
window.syncInterval = null; window.isLoggedIn = false; window.isAdmin = false;
window.isYTApiReady = false; window.currentFilter = 'All'; 

// ==========================================
// 🪟 Window Manager (เพิ่มระบบบันทึกตำแหน่งและขนาด)
// ==========================================
window.wm = {
    libWin: null, playerWin: null, lyricsWin: null, settingsWin: null, addWin: null, adminSyncWin: null, artistWin: null,

    // 🧠 ระบบจำค่าและป้องกันหน้าต่างหาย
    applyMemory: function(winId, options) {
        try {
            const saved = JSON.parse(localStorage.getItem('winbox_memory_' + winId));
            if (saved && saved.x < window.innerWidth - 50 && saved.y < window.innerHeight - 50) {
                options.x = saved.x;
                options.y = saved.y;
                options.width = saved.width;
                options.height = saved.height;
            }
        } catch(e) {}

        const originalOnMove = options.onmove;
        options.onmove = function(x, y) {
            if (originalOnMove) originalOnMove.call(this, x, y);
            window.wm.saveMemory(winId, this);
        };

        const originalOnResize = options.onresize;
        options.onresize = function(w, h) {
            if (originalOnResize) originalOnResize.call(this, w, h);
            window.wm.saveMemory(winId, this);
        };

        return options;
    },

    // 💾 เซฟค่าพิกัด
    saveMemory: function(winId, wbInstance) {
        const state = {
            x: wbInstance.x, y: wbInstance.y,
            width: wbInstance.width, height: wbInstance.height
        };
        localStorage.setItem('winbox_memory_' + winId, JSON.stringify(state));
    },

    openLibrary: function() {
        // 🔴 1. สั่งเปิดหน้าต่างศิลปินขึ้นมาพร้อมกันเสมอ
        if (!this.artistWin) {
            this.openArtists();
        } else {
            this.artistWin.focus(); // ถ้าเปิดทิ้งไว้อยู่แล้ว ให้เด้งขึ้นมาด้านหน้า
        }

        // 🏠 2. โค้ดเปิดคลังเพลง
        if (this.libWin) { this.libWin.focus(); return; }
        this.libWin = new WinBox("🏠 คลังเพลงของฉัน", this.applyMemory('library', {
            mount: document.getElementById("content-library"), width: "80%", height: "80%", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.libWin = null; }
        }));
        window.renderSongList();
    },
    openArtists: function() {
        // 🎤 3. ฟังก์ชันเปิดหน้าต่างศิลปินใหม่
        if (this.artistWin) { this.artistWin.focus(); return; }
        this.artistWin = new WinBox("🎤 ศิลปิน", this.applyMemory('artists', {
            mount: document.getElementById("content-artists"), 
            width: "500px", height: "400px", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.artistWin = null; }
        }));
    },
    openSettings: function() {
        if (this.settingsWin) { this.settingsWin.focus(); return; }
        this.settingsWin = new WinBox("⚙️ การตั้งค่า", this.applyMemory('settings', {
            mount: document.getElementById("content-settings"), width: "350px", height: "450px", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.settingsWin = null; }
        }));
    },
    openPlayer: function(title) {
        if (this.playerWin) { this.playerWin.setTitle("🎥 " + title); this.playerWin.focus(); return; }
        this.playerWin = new WinBox("🎥 " + title, this.applyMemory('player', {
            mount: document.getElementById("content-player"), width: "500px", height: "320px", x: "20px", y: "20px", class: ["wb-dark", "no-min"],
            onclose: () => { 
                this.playerWin = null;
                if (window.ytPlayer && typeof window.ytPlayer.destroy === 'function') {
                    window.ytPlayer.destroy();
                    window.ytPlayer = null;
                }
                document.getElementById("content-player").innerHTML = '<div id="youtubePlayer" style="width: 100%; height: 100%;"></div>';
            }
        }));
    },
    openLyrics: function(title) {
        if (this.lyricsWin) { this.lyricsWin.setTitle("📝 " + title); this.lyricsWin.focus(); return; }
        this.lyricsWin = new WinBox("📝 " + title, this.applyMemory('lyrics', {
            mount: document.getElementById("content-lyrics"), width: "500px", height: "80%", x: "right", y: "center", class: ["wb-dark"],
            onclose: () => { this.lyricsWin = null; }
        }));
    },
    openAdd: function(title) {
        if (this.addWin) { this.addWin.setTitle(title); this.addWin.focus(); return; }
        this.addWin = new WinBox(title, this.applyMemory('addedit', {
            mount: document.getElementById("content-add"), width: "450px", height: "80%", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.addWin = null; }
        }));
    },
    openAdminSync: function() {
        if (!window.isAdmin || !window.currentSongId) return;
        const song = window.songs.find(s => s.id === window.currentSongId);
        if (this.adminSyncWin) { this.adminSyncWin.setTitle("⏱ ซิงค์: " + song.title); this.adminSyncWin.focus(); return; }
        
        this.adminSyncWin = new WinBox("⏱ ซิงค์: " + song.title, this.applyMemory('adminsync', {
            mount: document.getElementById("content-admin-sync"), width: "450px", height: "80%", x: "center", y: "center", class: ["wb-dark"],
            onclose: () => { this.adminSyncWin = null; }
        }));
        window.renderTimestampEditor(); 
    }
};

// ปิด Dropdown ครอบคลุมเมื่อคลิกที่อื่น
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

// ==========================================
// 🖼️ ระบบ Wallpaper
// ==========================================
window.setWallpaper = function(url) {
    const wp = document.getElementById('desktop-wallpaper');
    const input = document.getElementById('inputCustomWallpaper');
    if (!wp) return;

    if (url === 'default' || !url) {
        wp.style.backgroundImage = 'none';
        localStorage.removeItem('customWallpaper');
        if (input) input.value = '';
    } else {
        wp.style.backgroundImage = `url('${url}')`;
        localStorage.setItem('customWallpaper', url);
        if (input && input.value !== url) input.value = url;
    }
}
// โหลด Wallpaper ตอนเปิดเว็บ
const savedWp = localStorage.getItem('customWallpaper');
if (savedWp) window.setWallpaper(savedWp);

window.onYouTubeIframeAPIReady = function() { window.isYTApiReady = true; };
const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(tag);

// ==========================================
// การตรวจสิทธิ์ & ดึงข้อมูล
// ==========================================
onAuthStateChanged(auth, (user) => {
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
    
    document.getElementById('btnHeaderLogout').style.display = window.isLoggedIn ? 'block' : 'none';
    document.getElementById('btnHeaderLogin').style.display = window.isLoggedIn ? 'none' : 'block';
    document.getElementById('btnAddSong').style.display = window.isAdmin ? 'block' : 'none';
    
    // โชว์ปุ่ม Admin Sync เฉพาะตอนที่ล็อกอินแอดมิน
    document.getElementById('btnDockAdminSync').style.display = window.isAdmin ? 'block' : 'none';
    
    fetchSongs(); 
});

window.loginWithGoogle = async function() { try { await signInWithPopup(auth, provider); } catch (e) { alert("เข้าสู่ระบบไม่สำเร็จ"); } }
window.logout = async function() { if(confirm('ต้องการออกจากระบบใช่หรือไม่?')) { await signOut(auth); } }

async function fetchSongs() {
    document.getElementById('loadingOverlay').style.display = 'flex';
    try {
        const querySnapshot = await getDocs(songsCollection);
        window.songs = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            window.songs.push({ id: doc.id, title: data.title, artist: data.artist, audioPath: data.audioPath, lyrics: data.lyrics, timestamps: data.timestamps || [], singers: data.singers || [] });
        });
        document.getElementById('loadingOverlay').style.display = 'none';
        
        const urlParams = new URLSearchParams(window.location.search);
        const songIdFromUrl = urlParams.get('song');
        if (songIdFromUrl) {
            const foundSong = window.songs.find(s => s.id === songIdFromUrl);
            if (foundSong) { window.playSong(foundSong.id); return; }
        }
        window.wm.openLibrary(); 
    } catch (error) { document.getElementById('loadingOverlay').style.display = 'none'; }
}

window.extractYouTubeID = function(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

window.openAddView = function() {
    if (!window.isAdmin) return;
    window.editingSongId = null;
    document.getElementById('inputTitle').value = ''; document.getElementById('inputArtist').value = ''; document.getElementById('inputAudio').value = ''; document.getElementById('inputLyrics').value = '';
    window.wm.openAdd('✨ เพิ่มเพลงใหม่');
}

window.editSong = function(id) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === id); if (!song) return;
    window.editingSongId = id;
    document.getElementById('inputTitle').value = song.title; document.getElementById('inputArtist').value = song.artist || ''; document.getElementById('inputAudio').value = song.audioPath; document.getElementById('inputLyrics').value = song.lyrics;
    window.wm.openAdd('✏️ แก้ไขเพลง');
}

window.saveSong = async function() {
    if (!window.isAdmin) return;
    const title = document.getElementById('inputTitle').value.trim(); const artist = document.getElementById('inputArtist').value.trim(); const audioPath = document.getElementById('inputAudio').value.trim(); const lyrics = document.getElementById('inputLyrics').value.trim();
    const btnSave = document.getElementById('btnSave');

    if (!title || !lyrics || !window.extractYouTubeID(audioPath)) { alert("ข้อมูลไม่ครบ หรือลิงก์ผิด"); return; }
    btnSave.disabled = true; btnSave.innerText = "กำลังบันทึก...";

    try {
        if (window.editingSongId) { await updateDoc(doc(db, "songs", window.editingSongId), { title, artist, audioPath, lyrics }); } 
        else { await addDoc(songsCollection, { title, artist, audioPath, lyrics, timestamps: [], singers: [] }); }
        await fetchSongs();
        if(window.wm.addWin) window.wm.addWin.close(); 
        if(window.wm.libWin) window.renderSongList(); 
    } catch (e) { alert("บันทึกไม่สำเร็จ"); } finally { btnSave.disabled = false; btnSave.innerText = "💾 บันทึกเพลง"; window.editingSongId = null; }
}

window.deleteSong = async function(id) {
    if (!window.isAdmin) return;
    if(confirm('ต้องการลบเพลงนี้ใช่หรือไม่?')) { try { await deleteDoc(doc(db, "songs", id)); await fetchSongs(); if(window.wm.libWin) window.renderSongList(); } catch(e) { console.error(e); } }
}

// 🔴 อัปเกรดฟังก์ชันกรองศิลปิน (สลับหน้าต่างได้ทันที)
window.filterByArtist = function(artist, btnElement) {
    // 1. จัดการไฮไลต์สีปุ่ม
    const chips = document.querySelectorAll('#artistChips .chip');
    if (chips.length > 0) {
        chips.forEach(c => c.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
    }

    // 2. กรองเพลง
    window.currentFilter = artist;
    const searchVal = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    window.renderSongList(searchVal, artist);

    // 3. โฟกัสหน้าต่างคลังเพลงให้เด้งขึ้นมาด้านหน้า
    window.wm.openLibrary();
}

window.filterSongs = function() { window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), window.currentFilter); }

window.renderSongList = function(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList'); const chipContainer = document.getElementById('artistChips');
    if(!listContainer) return; listContainer.innerHTML = '';

    if (chipContainer) {
        let artistSet = new Set();
        window.songs.forEach(s => window.getSingersList(s.artist).forEach(n => artistSet.add(n)));
        const artists = ['All', ...Array.from(artistSet)];
        // 🔴 ส่งค่า this ไปใน onclick ด้วยเพื่อให้ปุ่มเปลี่ยนสีตอนกดได้ถูกต้อง
        chipContainer.innerHTML = artists.map(a => `<button class="chip ${artistFilter === a ? 'active' : ''}" onclick="filterByArtist('${a}', this)">${a === 'All' ? 'ทั้งหมด' : a}</button>`).join('');
    }

    const filtered = window.songs.filter(song => {
        const q = query.toLowerCase(); const artist = song.artist || '';
        return ((song.title && song.title.toLowerCase().includes(q)) || artist.toLowerCase().includes(q)) && (artistFilter === 'All' || artist.includes(artistFilter));
    });

    filtered.forEach(song => {
        const item = document.createElement('div'); item.className = 'song-item';
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        let actionsHtml = window.isAdmin ? `<button class="btn-secondary" onclick="editSong('${song.id}')">✏️</button><button class="btn-secondary" style="color:#ff3b30;" onclick="deleteSong('${song.id}')">ลบ</button>` : '';
        item.innerHTML = `
            <img src="${thumbUrl}" onerror="this.style.display='none'">
            <div><div class="song-title">${song.title}</div><div class="song-artist">🎤 ${song.artist || '-'}</div></div>
            <div class="song-actions"><button class="btn-primary" onclick="playSong('${song.id}')">▶ เล่น</button>${actionsHtml}</div>
        `;
        listContainer.appendChild(item);
    });
}

// ==========================================
// ระบบเล่นเพลง & จัดการเวลา (Full Admin Controls)
// ==========================================
window.renderLyricsToContainer = function() {
    const container = document.getElementById('lyricsContainer'); if(!container) return;
    container.innerHTML = ''; if (window.currentLyricsArray.length === 0) { container.innerHTML = 'ไม่มีเนื้อเพลง'; return; }
    const song = window.songs.find(s => s.id === window.currentSongId);

    window.currentLyricsArray.forEach((lyric, index) => {
        const lineDiv = document.createElement('div'); lineDiv.className = 'lyric-line'; lineDiv.id = `lyric-line-${index}`;
        const linesHtml = lyric.split('\n').map((l, i) => `<div class="lang-${i}">${l}</div>`).join('');
        const singerString = (song && song.singers && song.singers[index]) ? song.singers[index] : null;

        if (singerString) {
            const badgesHtml = singerString.split(',').filter(s=>s.trim()).map(s => `<span class="singer-badge">${s.trim()}</span>`).join('');
            lineDiv.innerHTML = `<div class="singer-badges">${badgesHtml}</div>${linesHtml}`;
        } else { lineDiv.innerHTML = linesHtml; }
        container.appendChild(lineDiv);
    });
}

window.playSong = function(id) {
    window.currentSongId = id; const song = window.songs.find(s => s.id === id); if (!song) return;

    window.currentLyricsArray = song.lyrics.split(/\n\s*\n/); window.currentLyricIndex = -1;
    
    window.wm.openPlayer(song.title); window.wm.openLyrics(song.title);
    if (window.wm.adminSyncWin) window.wm.adminSyncWin.setTitle("⏱ ซิงค์: " + song.title); 

    window.renderTimestampEditor(); window.renderLyricsToContainer(); window.updateLyricDisplay();

    const videoId = window.extractYouTubeID(song.audioPath);
    const bgEl = document.getElementById('dynamic-bg');
    if (bgEl && videoId) { bgEl.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`; bgEl.classList.add('active'); }
    
    // เช็คและสร้างกล่อง YouTube ใหม่ (ในกรณีที่หน้าต่างถูกปิดไปแล้ว)
    let playerDiv = document.getElementById('youtubePlayer');
    if (!playerDiv) {
        document.getElementById('content-player').innerHTML = '<div id="youtubePlayer" style="width: 100%; height: 100%;"></div>';
    }

    if (window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') { 
        window.ytPlayer.loadVideoById(videoId); 
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
        const currentSong = window.songs.find(s => s.id === window.currentSongId); if (!currentSong || !currentSong.timestamps) return;
        const currentTime = window.ytPlayer.getCurrentTime(); if (currentTime === undefined || currentTime === 0) return;

        const nextIndex = window.currentLyricIndex + 1;
        if (nextIndex <= window.currentLyricsArray.length) {
            const targetTime = currentSong.timestamps[nextIndex];
            if (targetTime != null && currentTime >= targetTime) window.nextLyric(true); 
        }
    }, 100); 
}

// 🔴 ระบบ Admin แบบเต็ม (เพิ่มเนื้อ ลบเนื้อ เลือกคนร้อง)
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
    const container = document.getElementById('timestampList'); if(!container) return;
    container.innerHTML = '';
    const song = window.songs.find(s => s.id === window.currentSongId); if (!song) return;

    window.currentLyricsArray.forEach((lyric, index) => {
        const row = document.createElement('div'); row.className = 'ts-row'; row.id = `ts-row-${index}`;
        row.style.background = 'rgba(255, 255, 255, 0.05)'; row.style.padding = '12px 10px'; row.style.borderRadius = '8px'; row.style.marginBottom = '12px'; row.style.border = '1px solid rgba(255, 255, 255, 0.1)';

        // 1. ช่องเขียนเนื้อเพลง
        const lyricEditor = document.createElement('textarea');
        lyricEditor.value = lyric; lyricEditor.style.width = '100%'; lyricEditor.style.minHeight = '55px'; lyricEditor.style.marginBottom = '10px';
        if (!window.isAdmin) { lyricEditor.readOnly = true; lyricEditor.style.border = 'none'; lyricEditor.style.background = 'transparent'; } 
        else { lyricEditor.onchange = (e) => { window.currentLyricsArray[index] = e.target.value.trim(); window.saveTimestampsToFirebase(true); }; }
        row.appendChild(lyricEditor);

        const controlsDiv = document.createElement('div'); controlsDiv.style.display = 'flex'; controlsDiv.style.justifyContent = 'space-between'; controlsDiv.style.alignItems = 'center'; controlsDiv.style.flexWrap = 'wrap'; controlsDiv.style.gap = '8px';
        const leftControls = document.createElement('div'); leftControls.style.display = 'flex'; leftControls.style.gap = '8px'; leftControls.style.alignItems = 'center';
        
        // แบทจ์ลำดับ
        const badge = document.createElement('span'); badge.innerText = `#${index + 1}`; badge.style.color = '#0a84ff'; badge.style.fontWeight = 'bold'; leftControls.appendChild(badge);

        if (window.isAdmin) {
            // 2. Dropdown เลือกนักร้อง
            const allSingers = window.getSingersList(song.artist);
            const dropdown = document.createElement('div'); dropdown.className = 'ts-singer-dropdown';
            const toggleBtn = document.createElement('button'); toggleBtn.className = 'ts-dropdown-toggle';
            const currentSingers = (song.singers && song.singers[index]) ? song.singers[index].split(',').map(s=>s.trim()).filter(s=>s) : [];
            toggleBtn.innerText = currentSingers.length > 0 ? currentSingers.join(', ') : '👤 เลือกร้อง';
            
            const menu = document.createElement('div'); menu.className = 'ts-dropdown-menu';
            allSingers.forEach(singer => {
                const itemLabel = document.createElement('label'); itemLabel.className = 'ts-dropdown-item';
                const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = singer; checkbox.checked = currentSingers.includes(singer);
                checkbox.onchange = () => {
                    const selected = Array.from(menu.querySelectorAll('input:checked')).map(cb => cb.value);
                    toggleBtn.innerText = selected.length > 0 ? selected.join(', ') : '👤 เลือกร้อง';
                    if (!song.singers) song.singers = []; song.singers[index] = selected.length > 0 ? selected.join(', ') : "";
                    window.saveTimestampsToFirebase(true); 
                };
                itemLabel.appendChild(checkbox); itemLabel.appendChild(document.createTextNode(' ' + singer)); menu.appendChild(itemLabel);
            });
            toggleBtn.onclick = (e) => {
                e.stopPropagation(); const isShowing = menu.classList.contains('show'); document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
                if (!isShowing) { menu.classList.add('show'); const rect = toggleBtn.getBoundingClientRect(); menu.style.position = 'fixed'; menu.style.left = rect.left + 'px'; menu.style.top = (rect.bottom + 5) + 'px'; }
            };
            dropdown.appendChild(toggleBtn); dropdown.appendChild(menu); leftControls.appendChild(dropdown);

            // 3. ช่องกรอกเวลาแบบละเอียด
            const timeInput = document.createElement('input'); timeInput.type = 'number'; timeInput.step = '0.1'; timeInput.min = '0';
            timeInput.style.width = '70px'; timeInput.style.margin = '0'; timeInput.style.padding = '4px 6px'; timeInput.style.textAlign = 'center';
            timeInput.value = (song.timestamps && song.timestamps[index] != null) ? song.timestamps[index].toFixed(1) : '';
            timeInput.onchange = (e) => { const val = parseFloat(e.target.value); if (!song.timestamps) song.timestamps = []; song.timestamps[index] = isNaN(val) ? null : val; window.saveTimestampsToFirebase(); };
            leftControls.appendChild(timeInput);
        }

        const rightControls = document.createElement('div'); rightControls.style.display = 'flex'; rightControls.style.gap = '8px';
        if (window.isAdmin) {
            // 4. ปุ่ม แทรก / ลบ 
            const btnAdd = document.createElement('button'); btnAdd.innerText = '➕'; btnAdd.style.background = 'rgba(52, 199, 89, 0.2)'; btnAdd.style.color = '#34c759'; btnAdd.style.border = '1px solid rgba(52, 199, 89, 0.4)'; btnAdd.style.padding = '4px 10px'; btnAdd.onclick = () => window.addLyricLine(index);
            const btnDel = document.createElement('button'); btnDel.innerText = '🗑️'; btnDel.style.background = 'rgba(255, 59, 48, 0.2)'; btnDel.style.color = '#ff3b30'; btnDel.style.border = '1px solid rgba(255, 59, 48, 0.4)'; btnDel.style.padding = '4px 10px'; btnDel.onclick = () => window.deleteLyricLine(index);
            rightControls.appendChild(btnAdd); rightControls.appendChild(btnDel);
        }
        
        controlsDiv.appendChild(leftControls); controlsDiv.appendChild(rightControls);
        row.appendChild(controlsDiv); container.appendChild(row);
    });
    
    if (window.isAdmin) {
        const btnAddEnd = document.createElement('button'); btnAddEnd.innerText = '➕ เพิ่มท่อนใหม่ต่อท้ายสุด'; btnAddEnd.style.background = 'rgba(255, 255, 255, 0.1)'; btnAddEnd.style.padding = "8px"; btnAddEnd.style.color = "#fff"; btnAddEnd.style.border = "none"; btnAddEnd.style.borderRadius = "8px"; btnAddEnd.style.width = "100%"; btnAddEnd.style.cursor = "pointer";
        btnAddEnd.onclick = () => window.addLyricLine(window.currentLyricsArray.length - 1); container.appendChild(btnAddEnd);
    }
}

window.addLyricLine = function(index) {
    if (!confirm('ต้องการแทรกเนื้อเพลงใช่หรือไม่?')) return;
    const song = window.songs.find(s => s.id === window.currentSongId); if(!song) return;
    const insertAt = index + 1;
    window.currentLyricsArray.splice(insertAt, 0, "ท่อนใหม่...");
    if(!song.timestamps) song.timestamps = []; song.timestamps.splice(insertAt, 0, null);
    if(!song.singers) song.singers = []; song.singers.splice(insertAt, 0, "");
    window.saveTimestampsToFirebase(true).then(() => { window.renderTimestampEditor(); });
}

window.deleteLyricLine = function(index) {
    if (!confirm('ลบท่อนนี้ใช่หรือไม่?\nเนื้อเพลงและเวลาที่เกี่ยวข้องจะหายไปทั้งหมด')) return;
    const song = window.songs.find(s => s.id === window.currentSongId); if(!song) return;
    window.currentLyricsArray.splice(index, 1);
    if(song.timestamps) song.timestamps.splice(index, 1);
    if(song.singers) song.singers.splice(index, 1);
    window.saveTimestampsToFirebase(true).then(() => { window.renderTimestampEditor(); });
}

window.syncTimestampEditorUI = function() {
    window.currentLyricsArray.forEach((_, index) => {
        const row = document.getElementById(`ts-row-${index}`);
        if (row) {
            if (index === window.currentLyricIndex) { row.style.background = 'rgba(10, 132, 255, 0.25)'; row.style.borderColor = '#0a84ff'; } 
            else { row.style.background = 'rgba(255, 255, 255, 0.05)'; row.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }
        }
    });
}

window.updateLyricDisplay = function() {
    const container = document.getElementById('lyricsContainer'); if (!container) return;
    container.querySelectorAll('.lyric-line').forEach(line => line.classList.remove('active'));

    if (window.currentLyricIndex >= 0 && window.currentLyricIndex < window.currentLyricsArray.length) {
        const activeLine = document.getElementById(`lyric-line-${window.currentLyricIndex}`);
        if (activeLine) { activeLine.classList.add('active'); activeLine.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }
    window.syncTimestampEditorUI(); // ไฮไลต์กล่องในหน้าต่าง Admin ด้วย
}

window.nextLyric = function(isAuto = false) {
    if (window.currentLyricIndex < window.currentLyricsArray.length) {
        window.currentLyricIndex++; window.updateLyricDisplay();
        if (!isAuto && window.isAdmin && window.currentSongId && window.ytPlayer) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) { if (!song.timestamps) song.timestamps = []; song.timestamps[window.currentLyricIndex] = window.ytPlayer.getCurrentTime(); window.saveTimestampsToFirebase(); }
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
        if (song) { song.timestamps = []; song.singers = []; window.saveTimestampsToFirebase(); window.currentLyricIndex = -1; window.renderTimestampEditor(); window.updateLyricDisplay(); }
    }
}

window.toggleLang = function(langIndex) {
    const container = document.getElementById('lyricsContainer'); if (!container) return;
    if (event.target.checked) container.classList.remove(`hide-lang-${langIndex}`); else container.classList.add(`hide-lang-${langIndex}`);
}

window.onPlayerStateChange = function(event) {
    if (event.data === 0) {
        const idx = window.songs.findIndex(s => s.id === window.currentSongId);
        if (idx !== -1 && idx + 1 < window.songs.length) window.playSong(window.songs[idx + 1].id);
    }
};

// ==========================================
// ⚙️ ระบบ Custom Theme & Personalization
// ==========================================
window.setAccentColor = function(color) {
    document.documentElement.style.setProperty('--accent-color', color);
    localStorage.setItem('ws_accent', color);
}

window.setWindowStyle = function() {
    const op = document.getElementById('sliderOpacity').value;
    const blur = document.getElementById('sliderBlur').value;
    const opacityVal = op / 100;
    
    document.documentElement.style.setProperty('--window-opacity', opacityVal);
    document.documentElement.style.setProperty('--window-blur', blur + 'px');
    
    localStorage.setItem('ws_opacity', opacityVal);
    localStorage.setItem('ws_blur', blur);
}

window.setLyricFontSize = function(size) {
    document.documentElement.style.setProperty('--lyric-font-size', size + 'em');
    localStorage.setItem('ws_fontsize', size);
}

// โหลดค่า Custom ทั้งหมดตอนเปิดแอป
window.loadCustomSettings = function() {
    const acc = localStorage.getItem('ws_accent');
    const op = localStorage.getItem('ws_opacity');
    const bl = localStorage.getItem('ws_blur');
    const fs = localStorage.getItem('ws_fontsize');

    if(acc) setAccentColor(acc);
    if(op && bl) {
        document.documentElement.style.setProperty('--window-opacity', op);
        document.documentElement.style.setProperty('--window-blur', bl + 'px');
        const slOp = document.getElementById('sliderOpacity');
        const slBl = document.getElementById('sliderBlur');
        if(slOp) slOp.value = Math.round(op * 100);
        if(slBl) slBl.value = bl;
    }
    if(fs) {
        setLyricFontSize(fs);
        const slFs = document.getElementById('sliderFontSize');
        if(slFs) slFs.value = fs;
    }
}

// สั่งให้โหลดค่าทันที
document.addEventListener('DOMContentLoaded', () => {
    window.loadCustomSettings();
});

// ==========================================
// 📝 ระบบเรียกดูเนื้อเพลงซ้ำ
// ==========================================
window.openActiveLyrics = function() {
    if (!window.currentSongId) {
        alert('กรุณาเลือกเปิดเพลงจากคลังเพลงก่อนครับ 🎵');
        return;
    }
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (song) {
        window.wm.openLyrics(song.title);
        // สั่งให้วาดเนื้อเพลงและไฮไลต์ท่อนปัจจุบันใหม่
        window.renderLyricsToContainer();
        window.updateLyricDisplay();
    }
};

// ==========================================
// 🔄 ระบบดึงหน้าต่างกลับเข้าจอ (แก้ปัญหาหมุนจอ iPad)
// ==========================================
window.addEventListener('resize', () => {
    // รวมหน้าต่างทั้งหมดที่มีโอกาสถูกเปิดไว้
    const wins = [
        { id: 'library', ref: window.wm.libWin },
        { id: 'settings', ref: window.wm.settingsWin },
        { id: 'player', ref: window.wm.playerWin },
        { id: 'lyrics', ref: window.wm.lyricsWin },
        { id: 'addedit', ref: window.wm.addWin },
        { id: 'adminsync', ref: window.wm.adminSyncWin },
        { id: 'artists', ref: window.wm.artistWin } // 🔴 เพิ่มหน้าต่างศิลปินเข้ามาในระบบตรวจจับด้วย
    ];

    wins.forEach(winObj => {
        // เช็คว่าหน้าต่างนั้นเปิดอยู่ไหม
        if (winObj.ref && winObj.ref.dom) {
            const rect = winObj.ref.dom.getBoundingClientRect();
            let newX = rect.left;
            let newY = rect.top;
            let needMove = false;

            // ถ้าหน้าต่างหลุดขอบขวา (เกินความกว้างจอ)
            if (newX + 50 > window.innerWidth) { 
                newX = Math.max(10, window.innerWidth - rect.width - 20); 
                needMove = true; 
            }
            // ถ้าหน้าต่างหลุดขอบล่าง (เกินความสูงจอ)
            if (newY + 50 > window.innerHeight) { 
                newY = Math.max(10, window.innerHeight - rect.height - 100); // เผื่อที่ให้ Dock ด้วย
                needMove = true; 
            }
            // ถ้าหน้าต่างหลุดขอบซ้าย หรือ ขอบบน
            if (newX < 0) { newX = 20; needMove = true; }
            if (newY < 0) { newY = 20; needMove = true; }

            // ถ้าหลุดขอบให้สั่งย้ายพิกัดกลับเข้าจอ
            if (needMove) {
                winObj.ref.move(newX, newY);
                window.wm.saveMemory(winObj.id, winObj.ref); // เซฟตำแหน่งใหม่ทับของเดิม
            }
        }
    });
});
