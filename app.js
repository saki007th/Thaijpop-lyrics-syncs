import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeSingerColors, openSingerColorManager } from './singerColors.js';

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

// ฟังก์ชันสำหรับดึงชื่อศิลปินทั้งหมดมาใส่ใน Datalist
window.updateArtistSuggestions = function() {
    const datalist = document.getElementById('artistList');
    if (!datalist) return; 

    const allSingers = new Set();
    
    if (window.SINGER_COLORS) {
        Object.keys(window.SINGER_COLORS).forEach(s => allSingers.add(s));
    }
    
    if (window.songs) {
        window.songs.forEach(song => {
            if (song.artist) song.artist.split(',').forEach(s => allSingers.add(s.trim()));
        });
    }

    datalist.innerHTML = '';
    
    Array.from(allSingers).sort().forEach(singer => {
        if (singer && singer !== 'ดนตรี') {
            const option = document.createElement('option');
            option.value = singer;
            datalist.appendChild(option);
        }
    });
};

// ==========================================
// 🪟 Window Manager  
// ==========================================
window.wm = {
    libWin: null, playerWin: null, lyricsWin: null, settingsWin: null, addWin: null, adminSyncWin: null,

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

        const originalOnClose = options.onclose;
        options.onclose = function(force) {
            if (!force) {
                this.addClass('closing'); 
                setTimeout(() => this.close(true), 300); 
                return true; 
            }
            if (originalOnClose) return originalOnClose.call(this, force);
        };

        return options;
    },
    
    saveMemory: function(winId, wbInstance) {
        const state = {
            x: wbInstance.x, y: wbInstance.y,
            width: wbInstance.width, height: wbInstance.height
        };
        localStorage.setItem('winbox_memory_' + winId, JSON.stringify(state));
    },

    openLibrary: function() {
        if (this.libWin) { this.libWin.focus(); return; }
        this.libWin = new WinBox("🏠 คลังเพลงของฉัน", this.applyMemory('library', {
            mount: document.getElementById("content-library"), width: "80%", height: "80%", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.libWin = null; }
        }));
        window.renderSongList();
    },
    openSettings: function() {
        if (this.settingsWin) { this.settingsWin.focus(); return; }
        this.settingsWin = new WinBox("⚙️ การตั้งค่า", this.applyMemory('settings', {
            mount: document.getElementById("content-settings"), width: "350px", height: "450px", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.settingsWin = null; }
        }));
    },
   openPlayer: function(title) {
        if (this.playerWin) { this.playerWin.setTitle("🎥 " + title); this.playerWin.focus(); return; }
        this.playerWin = new WinBox("🎥 " + title, this.applyMemory('player', {
            mount: document.getElementById("content-player"), width: "500px", height: "320px", x: "20px", y: "80px", top: 70, class: ["wb-dark", "no-min"],
                onclose: () => { 
                this.playerWin = null;
                if (window.ytPlayer && typeof window.ytPlayer.destroy === 'function') {
                    window.ytPlayer.destroy();
                    window.ytPlayer = null;
                }
                document.getElementById("content-player").innerHTML = '<div id="youtubePlayer" style="width: 100%; height: 100%;"></div>';
                
                const liveAct = document.getElementById('liveActivity');
                const liveDiv = document.getElementById('dockDivider');
                if (liveAct) liveAct.classList.add('hidden');
                if (liveDiv) liveDiv.classList.add('hidden');
                
                const bgEl = document.getElementById('dynamic-bg');
                if (bgEl) bgEl.classList.remove('active');

                window.currentSongId = null;
                
                if(window.setRandomPanelState) window.setRandomPanelState(true);
                if (window.wm.lyricsWin) { window.wm.lyricsWin.close(); }
                if (window.wm.adminSyncWin) { window.wm.adminSyncWin.close(); }
            }
        }));
    },
    openLyrics: function(title) {
        if (this.lyricsWin) { this.lyricsWin.setTitle("📝 " + title); this.lyricsWin.focus(); return; }
        this.lyricsWin = new WinBox("📝 " + title, this.applyMemory('lyrics', {
            mount: document.getElementById("content-lyrics"), width: "500px", height: "80%", x: "right", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.lyricsWin = null; }
        }));
    },
    openAdd: function(title) {
        if (this.addWin) { this.addWin.setTitle(title); this.addWin.focus(); return; }
        this.addWin = new WinBox(title, this.applyMemory('addedit', {
            mount: document.getElementById("content-add"), width: "450px", height: "80%", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.addWin = null; }
        }));
    },
    openAdminSync: function() {
        if (!window.isAdmin || !window.currentSongId) return;
        const song = window.songs.find(s => s.id === window.currentSongId);
        if (this.adminSyncWin) { this.adminSyncWin.setTitle("⏱ ซิงค์: " + song.title); this.adminSyncWin.focus(); return; }
        
        this.adminSyncWin = new WinBox("⏱ ซิงค์: " + song.title, this.applyMemory('adminsync', {
            mount: document.getElementById("content-admin-sync"), width: "450px", height: "80%", x: "center", y: "center", top: 70, class: ["wb-dark"],
            onclose: () => { this.adminSyncWin = null; }
        }));
        window.renderTimestampEditor(); 
    }
};

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
const savedWp = localStorage.getItem('customWallpaper');
if (savedWp) window.setWallpaper(savedWp);

window.onYouTubeIframeAPIReady = function() { window.isYTApiReady = true; };
const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(tag);

// ==========================================
// การตรวจสิทธิ์ & ดึงข้อมูล
// ==========================================
onAuthStateChanged(auth, async (user) => {  
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
    
    document.getElementById('btnHeaderLogout').style.display = window.isLoggedIn ? 'block' : 'none';
    document.getElementById('btnHeaderLogin').style.display = window.isLoggedIn ? 'none' : 'block';
    document.getElementById('btnAddSong').style.display = window.isAdmin ? 'block' : 'none';
    document.getElementById('btnDockAdminSync').style.display = window.isAdmin ? 'block' : 'none';
    
    let btnColor = document.getElementById('btnColorAdmin');
    if (window.isAdmin) {
        if (!btnColor) {
            btnColor = document.createElement('button');
            btnColor.id = 'btnColorAdmin';
            btnColor.innerHTML = '🎨 จัดการสีนักร้อง';
            btnColor.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:100; background:#9370DB; color:#fff; border:none; padding:10px 15px; border-radius:20px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); font-weight:bold;';
            btnColor.onclick = () => openSingerColorManager(db);
            document.body.appendChild(btnColor);
        }
        btnColor.style.display = 'block';
    } else {
        if (btnColor) btnColor.style.display = 'none';
    }

    await initializeSingerColors(db);
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
            window.songs.push({ 
                id: doc.id, 
                title: data.title, 
                artist: data.artist, 
                audioPath: data.audioPath, 
                lyrics: data.lyrics, 
                timestamps: data.timestamps || [], 
                singers: data.singers || [], 
                covers: data.covers || [], // ดึงข้อมูล Cover
                createdAt: data.createdAt 
            });
        });
        
        document.getElementById('loadingOverlay').style.display = 'none';
        
        window.renderRandomPlaylist();
        
        if(window.checkNewSongsNotification) {
            window.checkNewSongsNotification();
        }

        if (window.updateArtistSuggestions) {
            window.updateArtistSuggestions();
        }
    
        const urlParams = new URLSearchParams(window.location.search);
        const songIdFromUrl = urlParams.get('song');
        
        if (songIdFromUrl) {
            const foundSong = window.songs.find(s => s.id === songIdFromUrl);
            if (foundSong) { 
                window.playSong(foundSong.id); 
                return; 
            }
        }
        
        window.wm.openLibrary(); 
        
    } catch (error) { 
        document.getElementById('loadingOverlay').style.display = 'none'; 
        console.error("Error fetching songs: ", error); 
    }
}

window.extractYouTubeID = function(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

// ==========================================
// 🎧 ระบบจัดการข้อมูล Cover ในหน้าเพิ่ม/แก้ไข
// ==========================================
window.currentCoversDraft = [];

window.renderCoverInputs = function() {
    const container = document.getElementById('coverInputsContainer'); if (!container) return;
    container.innerHTML = '';

    window.currentCoversDraft.forEach((cover, index) => {
        const div = document.createElement('div');
        div.style.background = 'rgba(0, 0, 0, 0.2)'; div.style.padding = '10px'; div.style.borderRadius = '8px'; div.style.marginBottom = '10px'; div.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 0.85em; font-weight: bold; color: #ccc;">Cover #${index + 1}</span>
                <button onclick="removeCoverInput(${index})" style="background: none; border: none; color: #ff3b30; cursor: pointer; font-size: 0.85em;">🗑 ลบ</button>
            </div>
            <input type="text" placeholder="ชื่อคนร้อง (เช่น Gawr Gura)" value="${cover.coverArtist || ''}" style="margin-bottom: 8px; padding: 8px; font-size: 0.9em;" onchange="window.currentCoversDraft[${index}].coverArtist = this.value.trim()">
            <input type="text" placeholder="ลิงก์ YouTube" value="${cover.audioPath || ''}" style="margin-bottom: 0; padding: 8px; font-size: 0.9em;" onchange="window.currentCoversDraft[${index}].audioPath = this.value.trim()">
        `;
        container.appendChild(div);
    });
}

window.addCoverInput = function() {
    window.currentCoversDraft.push({ coverId: 'c_' + Date.now(), coverArtist: '', audioPath: '', timestamps: null, singers: null });
    window.renderCoverInputs();
}
window.removeCoverInput = function(index) {
    if(confirm('ต้องการลบ Cover นี้ใช่หรือไม่? (ลบแล้วต้องกดบันทึกเพลงด้วยนะ)')) { window.currentCoversDraft.splice(index, 1); window.renderCoverInputs(); }
}

window.openAddView = function() {
    if (!window.isAdmin) return;
    window.editingSongId = null;
    document.getElementById('inputTitle').value = ''; document.getElementById('inputArtist').value = ''; document.getElementById('inputAudio').value = ''; document.getElementById('inputLyrics').value = '';
    window.currentCoversDraft = []; window.renderCoverInputs(); 
    window.wm.openAdd('✨ เพิ่มเพลงใหม่');
}

window.editSong = function(id) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === id); if (!song) return;
    window.editingSongId = id;
    document.getElementById('inputTitle').value = song.title; document.getElementById('inputArtist').value = song.artist || ''; document.getElementById('inputAudio').value = song.audioPath; document.getElementById('inputLyrics').value = song.lyrics;
    window.currentCoversDraft = song.covers ? JSON.parse(JSON.stringify(song.covers)) : []; window.renderCoverInputs(); 
    window.wm.openAdd('✏️ แก้ไขเพลง');
}

window.saveSong = async function() {
    if (!window.isAdmin) return;
    const title = document.getElementById('inputTitle').value.trim(); const artist = document.getElementById('inputArtist').value.trim(); const audioPath = document.getElementById('inputAudio').value.trim(); const lyrics = document.getElementById('inputLyrics').value.trim();
    const btnSave = document.getElementById('btnSave');

    if (!title || !lyrics || !window.extractYouTubeID(audioPath)) { alert("ข้อมูลไม่ครบ หรือลิงก์ผิด"); return; }
    btnSave.disabled = true; btnSave.innerText = "กำลังบันทึก...";

    const validCovers = (window.currentCoversDraft || []).filter(c => c.coverArtist && window.extractYouTubeID(c.audioPath));

    try {
        if (window.editingSongId) { 
            await updateDoc(doc(db, "songs", window.editingSongId), { title, artist, audioPath, lyrics, covers: validCovers }); 
        } else { 
            await addDoc(songsCollection, { title, artist, audioPath, lyrics, timestamps: [], singers: [], covers: validCovers, createdAt: Date.now() }); 
        }
        await fetchSongs();
        if(window.wm.addWin) window.wm.addWin.close(); 
        if(window.wm.libWin) window.renderSongList(); 
    } catch (e) { alert("บันทึกไม่สำเร็จ"); } finally { btnSave.disabled = false; btnSave.innerText = "💾 บันทึกเพลง"; window.editingSongId = null; }
}

window.deleteSong = async function(id) {
    if (!window.isAdmin) return;
    if(confirm('ต้องการลบเพลงนี้ใช่หรือไม่?')) { try { await deleteDoc(doc(db, "songs", id)); await fetchSongs(); if(window.wm.libWin) window.renderSongList(); } catch(e) { console.error(e); } }
}

window.filterByArtist = function(artistName) { window.currentFilter = artistName; window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), artistName); }
window.filterSongs = function() { window.renderSongList(document.getElementById('searchInput').value.toLowerCase(), window.currentFilter); }

window.renderSongList = function(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList'); const chipContainer = document.getElementById('artistChips');
    if(!listContainer) return; listContainer.innerHTML = '';

    if (chipContainer) {
        let artistSet = new Set();
        window.songs.forEach(s => window.getSingersList(s.artist).forEach(n => artistSet.add(n)));
        
        const sortedArtists = Array.from(artistSet).sort((a, b) => a.localeCompare(b, 'th')); 
        const artists = ['All', ...sortedArtists];
        
        chipContainer.innerHTML = artists.map(a => `<button class="chip ${artistFilter === a ? 'active' : ''}" onclick="filterByArtist('${a}')">${a === 'All' ? 'ทั้งหมด' : a}</button>`).join('');
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

// ✨ Helper: ดึงเวลาที่ถูกต้อง (รองรับ Fallback ต้นฉบับ)
window.getActiveTimestamps = function(song) {
    if (!song) return [];
    if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
        const coverTs = song.covers[window.currentCoverIndex].timestamps;
        if (coverTs && coverTs.some(t => t != null)) return coverTs; // ถ้า Cover มีเวลา ใช้เวลา Cover
    }
    return song.timestamps || []; // Fallback ถ้ายังไม่ได้ซิงค์ให้ใช้เวลาต้นฉบับ
};

// ✨ Helper: ดึงคนร้องที่ถูกต้อง
window.getActiveSingers = function(song) {
    if (!song) return [];
    if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
        const coverSg = song.covers[window.currentCoverIndex].singers;
        if (coverSg && coverSg.some(s => s !== "")) return coverSg;
    }
    return song.singers || [];
};

window.renderLyricsToContainer = function() {
    // โยนหน้าที่ให้ Engine ตัวใหม่ (ในไฟล์ lyrics-engine.js) จัดการแทน
    if (window.LyricsEngine) {
        window.LyricsEngine.render();
    } else {
        console.error("หาไฟล์ lyrics-engine.js ไม่เจอ! ตรวจสอบการ import ใน HTML");
    }
}
// ==========================================
// 🎧 ระบบเพลง Cover (Alternative Versions)
// ==========================================
window.currentCoverIndex = -1; 

window.renderVersionBadges = function() {
    const container = document.getElementById('versionContainer'); 
    if (!container) return;
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song || !song.covers || song.covers.length === 0) {
        container.style.display = 'none'; return;
    }
    container.style.display = 'flex'; container.className = 'version-badges-container'; container.innerHTML = '';
    container.appendChild(createBadgeElement('🌟 Original', song.artist, -1));
    song.covers.forEach((cover, index) => { container.appendChild(createBadgeElement(`🎧 Cover`, cover.coverArtist, index)); });
};

function createBadgeElement(label, artistName, index) {
    const badge = document.createElement('div'); badge.className = 'version-badge'; badge.innerText = `${label} : ${artistName}`;
    if (window.currentCoverIndex === index) {
        badge.classList.add('active');
        const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[artistName]) ? window.SINGER_COLORS[artistName] : '#0a84ff';
        let textColor = '#ffffff';
        if (badgeColor.startsWith('#')) {
            let hex = badgeColor.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(x=>x+x).join(''); 
            let r = parseInt(hex.substring(0,2), 16), g = parseInt(hex.substring(2,4), 16), b = parseInt(hex.substring(4,6), 16);
            let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            textColor = (yiq >= 140) ? '#000000' : '#ffffff';
        }
        badge.style.background = badgeColor; badge.style.color = textColor; badge.style.boxShadow = `0 0 12px ${badgeColor}80`; 
    }

    badge.onclick = () => {
        if (window.currentCoverIndex === index) return; 
        window.currentCoverIndex = index;
        window.renderVersionBadges(); 
        
        const song = window.songs.find(s => s.id === window.currentSongId);
        let targetVideoPath = song.audioPath; 
        if (index >= 0 && song.covers && song.covers[index]) targetVideoPath = song.covers[index].audioPath; 
        
        const videoId = window.extractYouTubeID(targetVideoPath);
        if (window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') window.ytPlayer.loadVideoById(videoId);
        
        window.currentLyricIndex = -1;
        // 🔴 สั่งให้หน้าต่าง Admin Sync โหลดเวลาของเวอร์ชันใหม่
        window.renderTimestampEditor(); 
        window.renderLyricsToContainer();
        window.updateLyricDisplay();
    };
    return badge;
}

window.playSong = function(id) {
    window.currentSongId = id; const song = window.songs.find(s => s.id === id); if (!song) return;

    window.currentCoverIndex = -1;
    window.renderVersionBadges();
    
    if(window.setRandomPanelState) window.setRandomPanelState(false);
    if(window.wm && window.wm.notifyWin) window.wm.notifyWin.close();
    
    const liveAct = document.getElementById('liveActivity'); const liveDiv = document.getElementById('dockDivider');
    if (liveAct && liveDiv) {
        document.getElementById('liveTitle').innerText = song.title;
        document.getElementById('liveArtist').innerText = '🎤 ' + (song.artist || '-');
        liveAct.classList.remove('hidden'); liveDiv.classList.remove('hidden');
    }

    window.currentLyricsArray = song.lyrics.split(/\n\s*\n/); window.currentLyricIndex = -1;
    
    window.wm.openPlayer(song.title); window.wm.openLyrics(song.title);
    if (window.wm.adminSyncWin) window.wm.adminSyncWin.setTitle("⏱ ซิงค์: " + song.title); 

    window.renderTimestampEditor(); window.renderLyricsToContainer(); window.updateLyricDisplay();

    const videoId = window.extractYouTubeID(song.audioPath); const bgEl = document.getElementById('dynamic-bg');
    if (bgEl && videoId) { bgEl.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`; bgEl.classList.add('active'); }
    
    let playerDiv = document.getElementById('youtubePlayer');
    if (!playerDiv) document.getElementById('content-player').innerHTML = '<div id="youtubePlayer" style="width: 100%; height: 100%;"></div>';

    if (window.ytPlayer && typeof window.ytPlayer.loadVideoById === 'function') { 
        window.ytPlayer.loadVideoById(videoId); 
    } else {
        if (window.isYTApiReady || (window.YT && window.YT.Player)) {
            window.ytPlayer = new YT.Player('youtubePlayer', { 
                height: '100%', width: '100%', videoId: videoId, playerVars: { 'playsinline': 1, 'controls': 1 }, events: { 'onStateChange': window.onPlayerStateChange } 
            });
        }
    }
    
    clearInterval(window.syncInterval);
    window.syncInterval = setInterval(() => {
        if (!window.ytPlayer || typeof window.ytPlayer.getCurrentTime !== 'function') return;
        const currentSong = window.songs.find(s => s.id === window.currentSongId); if (!currentSong) return;
        
        const activeTimestamps = window.getActiveTimestamps(currentSong);
        const currentTime = window.ytPlayer.getCurrentTime(); 
        if (currentTime === undefined || currentTime === 0) return;

        let correctIndex = -1;
        for (let i = 0; i < activeTimestamps.length; i++) {
            if (activeTimestamps[i] != null && currentTime >= activeTimestamps[i]) correctIndex = i;
        }
        if (window.currentLyricIndex !== correctIndex) {
            window.currentLyricIndex = correctIndex; window.updateLyricDisplay();
        }
    }, 100); 
}; 

// ==========================================
// 🔴 อัปเกรด: ฟังก์ชันบันทึกเวลาให้เซฟแยกลง Cover (ป้องกันเวลาหาย)
// ==========================================
window.saveTimestampsToFirebase = async function(updateLyricsText = false) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song) return;

    if (updateLyricsText) song.lyrics = window.currentLyricsArray.join('\n\n');
    const count = window.currentLyricsArray.length;
    
    let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);

    // 🟢 สำคัญมาก: ถ้าเป็น Cover และเพิ่งแก้ครั้งแรก ต้องโคลนเวลาต้นฉบับมาให้หมดก่อน
    if (isCover) {
        if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
            song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
        }
        if (!song.covers[window.currentCoverIndex].singers || song.covers[window.currentCoverIndex].singers.length === 0) {
            song.covers[window.currentCoverIndex].singers = [...(song.singers || [])];
        }
    }

    let currentTs = isCover ? (song.covers[window.currentCoverIndex].timestamps || []) : (song.timestamps || []);
    let currentSg = isCover ? (song.covers[window.currentCoverIndex].singers || []) : (song.singers || []);

    const safeTs = Array.from({length: count}, (_, i) => currentTs[i] != null ? currentTs[i] : null);
    const safeSg = Array.from({length: count}, (_, i) => currentSg[i] != null ? currentSg[i] : "");

    // เตรียม Payload ที่มี covers เดิมแนบไปด้วยเสมอ
    const payload = {
        timestamps: song.timestamps || [],
        singers: song.singers || [],
        covers: song.covers || []
    };
    if (updateLyricsText) payload.lyrics = song.lyrics; 

    if (isCover) {
        song.covers[window.currentCoverIndex].timestamps = safeTs;
        song.covers[window.currentCoverIndex].singers = safeSg;
        payload.covers = song.covers;
    } else {
        song.timestamps = safeTs; 
        song.singers = safeSg;
        payload.timestamps = safeTs; 
        payload.singers = safeSg;
    }

    await updateDoc(doc(db, "songs", window.currentSongId), payload);
    if (updateLyricsText) { window.renderLyricsToContainer(); window.updateLyricDisplay(); }
}

window.renderTimestampEditor = function() {
    const container = document.getElementById('timestampList'); if(!container) return;
    container.innerHTML = '';
    const song = window.songs.find(s => s.id === window.currentSongId); if (!song) return;

    let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
    
    // 🟢 โหลดเวลาให้ตรงเวอร์ชัน โดยดึงผ่าน Fallback
    let activeTimestamps = window.getActiveTimestamps(song);
    let activeSingers = window.getActiveSingers(song);

    window.currentLyricsArray.forEach((lyric, index) => {
        const row = document.createElement('div'); row.className = 'ts-row'; row.id = `ts-row-${index}`;
        row.style.background = 'rgba(255, 255, 255, 0.05)'; row.style.padding = '12px 10px'; row.style.borderRadius = '8px'; row.style.marginBottom = '12px'; row.style.border = '1px solid rgba(255, 255, 255, 0.1)';

        const lyricEditor = document.createElement('textarea');
        lyricEditor.value = lyric; lyricEditor.style.width = '100%'; lyricEditor.style.minHeight = '55px'; lyricEditor.style.marginBottom = '10px';
        if (!window.isAdmin) { lyricEditor.readOnly = true; lyricEditor.style.border = 'none'; lyricEditor.style.background = 'transparent'; } 
        else { lyricEditor.onchange = (e) => { window.currentLyricsArray[index] = e.target.value.trim(); window.saveTimestampsToFirebase(true); }; }
        row.appendChild(lyricEditor);

        const controlsDiv = document.createElement('div'); controlsDiv.style.display = 'flex'; controlsDiv.style.justifyContent = 'space-between'; controlsDiv.style.alignItems = 'center'; controlsDiv.style.flexWrap = 'wrap'; controlsDiv.style.gap = '8px';
        const leftControls = document.createElement('div'); leftControls.style.display = 'flex'; leftControls.style.gap = '8px'; leftControls.style.alignItems = 'center';
        
        const badge = document.createElement('span'); badge.innerText = `#${index + 1}`; badge.style.color = '#0a84ff'; badge.style.fontWeight = 'bold'; leftControls.appendChild(badge);

        if (window.isAdmin) {
            const allSingers = window.getSingersList(song.artist);
            const dropdown = document.createElement('div'); dropdown.className = 'ts-singer-dropdown'; dropdown.style.position = 'relative';
            const toggleBtn = document.createElement('button'); toggleBtn.className = 'ts-dropdown-toggle';
            const currentSingers = activeSingers[index] ? activeSingers[index].split(',').map(s=>s.trim()).filter(s=>s) : [];
            toggleBtn.innerText = currentSingers.length > 0 ? currentSingers.join(', ') : '👤 เลือกร้อง';
            
            const menu = document.createElement('div'); menu.className = 'ts-dropdown-menu';
            allSingers.forEach(singer => {
                const itemLabel = document.createElement('label'); itemLabel.className = 'ts-dropdown-item';
                const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = singer; checkbox.checked = currentSingers.includes(singer);
                checkbox.onchange = () => {
                    const selected = Array.from(menu.querySelectorAll('input:checked')).map(cb => cb.value);
                    toggleBtn.innerText = selected.length > 0 ? selected.join(', ') : '👤 เลือกร้อง';
                    if (isCover) {
                        // 🟢 ถ้าแก้คนร้องใน Cover ครั้งแรก ให้ก๊อปปี้มาทั้งหมดก่อน
                        if (!song.covers[window.currentCoverIndex].singers || song.covers[window.currentCoverIndex].singers.length === 0) {
                            song.covers[window.currentCoverIndex].singers = [...(song.singers || [])];
                        }
                        song.covers[window.currentCoverIndex].singers[index] = selected.length > 0 ? selected.join(', ') : "";
                    } else {
                        if (!song.singers) song.singers = []; song.singers[index] = selected.length > 0 ? selected.join(', ') : "";
                    }
                    window.saveTimestampsToFirebase(true); 
                };
                itemLabel.appendChild(checkbox); itemLabel.appendChild(document.createTextNode(' ' + singer)); menu.appendChild(itemLabel);
            });
            toggleBtn.onclick = (e) => {
                e.stopPropagation(); 
                const isShowing = menu.classList.contains('show'); 
                document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
                if (!isShowing) { 
                    menu.classList.add('show'); 
                    const rect = toggleBtn.getBoundingClientRect(); 
                    menu.style.position = 'absolute'; menu.style.left = '0'; 
                    if (window.innerHeight - rect.bottom < 200) { menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 5px)'; } 
                    else { menu.style.top = 'calc(100% + 5px)'; menu.style.bottom = 'auto'; }
                }
            };
            dropdown.appendChild(toggleBtn); dropdown.appendChild(menu); leftControls.appendChild(dropdown);

            const timeInput = document.createElement('input'); timeInput.type = 'number'; timeInput.step = '0.1'; timeInput.min = '0';
            timeInput.style.width = '70px'; timeInput.style.margin = '0'; timeInput.style.padding = '4px 6px'; timeInput.style.textAlign = 'center';
            timeInput.value = (activeTimestamps[index] != null) ? activeTimestamps[index].toFixed(1) : '';
            timeInput.onchange = (e) => { 
                const val = parseFloat(e.target.value); 
                const finalVal = isNaN(val) ? null : val;
                if (isCover) {
                    // 🟢 ถ้าแก้เวลาใน Cover ครั้งแรก ให้ก๊อปปี้เวลาทั้งหมดมาก่อน
                    if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
                        song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[window.currentCoverIndex].timestamps[index] = finalVal;
                } else {
                    if (!song.timestamps) song.timestamps = []; 
                    song.timestamps[index] = finalVal;
                }
                window.saveTimestampsToFirebase(); 
            };
            leftControls.appendChild(timeInput);
        }

        const rightControls = document.createElement('div'); rightControls.style.display = 'flex'; rightControls.style.gap = '8px';
        if (window.isAdmin) {
            const btnMusic = document.createElement('button'); btnMusic.innerText = '🎵 ดนตรี'; btnMusic.style.background = 'rgba(255, 159, 10, 0.2)'; btnMusic.style.color = '#ff9f0a'; btnMusic.style.border = '1px solid rgba(255, 159, 10, 0.4)'; btnMusic.style.padding = '4px 10px'; btnMusic.style.borderRadius = '6px'; btnMusic.style.cursor = 'pointer';
            btnMusic.onclick = () => { lyricEditor.value = '[ดนตรี]'; window.currentLyricsArray[index] = '[ดนตรี]'; window.saveTimestampsToFirebase(true); };

            const btnAdd = document.createElement('button'); btnAdd.innerText = '➕'; btnAdd.style.background = 'rgba(52, 199, 89, 0.2)'; btnAdd.style.color = '#34c759'; btnAdd.style.border = '1px solid rgba(52, 199, 89, 0.4)'; btnAdd.style.padding = '4px 10px'; btnAdd.onclick = () => window.addLyricLine(index);
            const btnDel = document.createElement('button'); btnDel.innerText = '🗑️'; btnDel.style.background = 'rgba(255, 59, 48, 0.2)'; btnDel.style.color = '#ff3b30'; btnDel.style.border = '1px solid rgba(255, 59, 48, 0.4)'; btnDel.style.padding = '4px 10px'; btnDel.onclick = () => window.deleteLyricLine(index);
            
            rightControls.appendChild(btnMusic); rightControls.appendChild(btnAdd); rightControls.appendChild(btnDel);
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
    
    if (song.covers) {
        song.covers.forEach(c => {
            if(c.timestamps) c.timestamps.splice(insertAt, 0, null);
            if(c.singers) c.singers.splice(insertAt, 0, "");
        });
    }
    window.saveTimestampsToFirebase(true).then(() => { window.renderTimestampEditor(); });
}

window.deleteLyricLine = function(index) {
    if (!confirm('ลบท่อนนี้ใช่หรือไม่?\\nเนื้อเพลงและเวลาที่เกี่ยวข้องจะหายไปทั้งหมด')) return;
    const song = window.songs.find(s => s.id === window.currentSongId); if(!song) return;
    window.currentLyricsArray.splice(index, 1);
    if(song.timestamps) song.timestamps.splice(index, 1);
    if(song.singers) song.singers.splice(index, 1);
    
    if (song.covers) {
        song.covers.forEach(c => {
            if(c.timestamps) c.timestamps.splice(index, 1);
            if(c.singers) c.singers.splice(index, 1);
        });
    }
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
    window.syncTimestampEditorUI(); 
}

window.nextLyric = function(isAuto = false) {
    if (window.currentLyricIndex < window.currentLyricsArray.length) {
        window.currentLyricIndex++; 
        window.updateLyricDisplay();
        
        if (!isAuto && window.isAdmin && window.currentSongId && window.ytPlayer) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) { 
                const currentTime = window.ytPlayer.getCurrentTime();
                let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);

                if (isCover) {
                    // 🟢 ถ้ากดยิงเวลาใน Cover ครั้งแรก ให้ก๊อปปี้เวลาทั้งหมดมาก่อน
                    if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
                        song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[window.currentCoverIndex].timestamps[window.currentLyricIndex] = currentTime;
                } else {
                    if (!song.timestamps) song.timestamps = []; 
                    song.timestamps[window.currentLyricIndex] = currentTime; 
                }
                
                const activeRow = document.getElementById(`ts-row-${window.currentLyricIndex}`);
                if (activeRow) {
                    const timeInput = activeRow.querySelector('input[type="number"]');
                    if (timeInput) timeInput.value = currentTime.toFixed(1);
                }
                window.saveTimestampsToFirebase(); 
            }
        }
    }
}

window.prevLyric = function() {
    if (window.currentLyricIndex > -1) {
        if (window.isAdmin && window.currentSongId) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) { 
                let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
                if (isCover) {
                    if (!song.covers[window.currentCoverIndex].timestamps || song.covers[window.currentCoverIndex].timestamps.length === 0) {
                        song.covers[window.currentCoverIndex].timestamps = [...(song.timestamps || [])];
                    }
                    song.covers[window.currentCoverIndex].timestamps[window.currentLyricIndex] = null;
                } else {
                    if (song.timestamps) song.timestamps[window.currentLyricIndex] = null; 
                }
                
                const activeRow = document.getElementById(`ts-row-${window.currentLyricIndex}`);
                if (activeRow) {
                    const timeInput = activeRow.querySelector('input[type="number"]');
                    if (timeInput) timeInput.value = '';
                }
                window.saveTimestampsToFirebase(); 
            }
        }
        window.currentLyricIndex--; 
        window.updateLyricDisplay();
    }
}

window.resetSync = function() {
    if (!window.isAdmin) return;
    if(confirm('ล้างเวลาทั้งหมดของเวอร์ชันที่กำลังเล่นอยู่?')) {
        const song = window.songs.find(s => s.id === window.currentSongId);
        if (song) { 
            let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
            if (isCover) {
                song.covers[window.currentCoverIndex].timestamps = [];
                song.covers[window.currentCoverIndex].singers = [];
            } else {
                song.timestamps = []; 
                song.singers = []; 
            }
            window.saveTimestampsToFirebase(); 
            window.currentLyricIndex = -1; 
            window.renderTimestampEditor(); 
            window.updateLyricDisplay(); 
        }
    }
}

window.toggleLang = function(langIndex) {
    const container = document.getElementById('lyricsContainer'); if (!container) return;
    if (event.target.checked) container.classList.remove(`hide-lang-${langIndex}`); else container.classList.add(`hide-lang-${langIndex}`);
}

window.onPlayerStateChange = function(event) {
    // 🔴 ซิงค์ไอคอนปุ่ม Play/Pause ใน Live Activity
    const playPauseBtn = document.getElementById('livePlayPauseBtn');
    if (event.data === 1 && playPauseBtn) playPauseBtn.innerText = '⏸'; // สถานะเล่น
    if (event.data === 2 && playPauseBtn) playPauseBtn.innerText = '▶'; // สถานะหยุดพัก

    if (event.data === 0) { // เลข 0 คือสถานะเพลงเล่นจบ
        if (!window.songs || window.songs.length === 0) return;

        if (window.isShuffleEnabled) {
            // 🔀 โหมดสุ่มเพลง (สุ่มให้ไม่ซ้ำเพลงเดิม)
            let randomIndex = Math.floor(Math.random() * window.songs.length);
            if (window.songs.length > 1) {
                const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
                while (randomIndex === currentIdx) {
                    randomIndex = Math.floor(Math.random() * window.songs.length);
                }
            }
            window.playSong(window.songs[randomIndex].id);
        } else {
            // ➡️ โหมดเล่นเรียงตามปกติ 
            const idx = window.songs.findIndex(s => s.id === window.currentSongId);
            if (idx !== -1 && idx + 1 < window.songs.length) {
                window.playSong(window.songs[idx + 1].id);
            } else {
                // 🛑 ถ้าไม่มีเพลงต่อให้ซ่อน UI
                const bgEl = document.getElementById('dynamic-bg');
                if (bgEl) bgEl.classList.remove('active');
                
                const liveAct = document.getElementById('liveActivity');
                const liveDiv = document.getElementById('dockDivider');
                if (liveAct) liveAct.classList.add('hidden');
                if (liveDiv) liveDiv.classList.add('hidden');
                
                window.currentSongId = null;
                
                if(window.setRandomPanelState) window.setRandomPanelState(true);
            }
        }
    }
};

// ==========================================
// ⚙️ ระบบ Custom Theme & Personalization
// ==========================================
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

window.setBgSize = function(size) {
    document.documentElement.style.setProperty('--bg-size', size);
    localStorage.setItem('ws_bgsize', size);
}

window.loadCustomSettings = function() {
    const op = localStorage.getItem('ws_opacity');
    const bl = localStorage.getItem('ws_blur');
    const fs = localStorage.getItem('ws_fontsize');
    const bgSz = localStorage.getItem('ws_bgsize'); 
    const shuffle = localStorage.getItem('ws_shuffle');

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
    if(bgSz) {
        setBgSize(bgSz);
        const selBg = document.getElementById('bgSizeSelect');
        if(selBg) selBg.value = bgSz;
    }
    if(shuffle === '1') {
        window.isShuffleEnabled = true;
        const chkShuffle = document.getElementById('toggleShuffleBtn');
        if(chkShuffle) chkShuffle.checked = true;
    }
}

window.isShuffleEnabled = false;

window.toggleShuffle = function(isEnable) {
    window.isShuffleEnabled = isEnable;
    localStorage.setItem('ws_shuffle', isEnable ? '1' : '0');
}

document.addEventListener('DOMContentLoaded', () => {
    window.loadCustomSettings();
});

// ==========================================
// 🎲 ระบบแถบสุ่มเพลงด้านขวา (Widget)
// ==========================================
window.setRandomPanelState = function(isOpen) {
    const panel = document.getElementById('randomPlaylistPanel');
    const icon = document.getElementById('panelToggleIcon');
    if (!panel || !icon) return;
    if (isOpen) {
        panel.classList.add('open');
        icon.innerText = '▶';
    } else {
        panel.classList.remove('open');
        icon.innerText = '◀';
    }
}

window.toggleRandomPanel = function() {
    const panel = document.getElementById('randomPlaylistPanel');
    if (panel) window.setRandomPanelState(!panel.classList.contains('open'));
}

window.renderRandomPlaylist = function() {
    const container = document.getElementById('randomSongList');
    if (!container || !window.songs || window.songs.length === 0) return;

    container.innerHTML = '';
    
    let shuffled = [...window.songs].sort(() => 0.5 - Math.random());
    let selected = shuffled.slice(0, 5);

    selected.forEach(song => {
        const item = document.createElement('div');
        item.className = 'random-song-item';
        item.onclick = () => window.playSong(song.id);

        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';

        item.innerHTML = `
            <img src="${thumbUrl}" onerror="this.style.display='none'">
            <div class="random-song-info">
                <div class="random-song-title">${song.title}</div>
                <div class="random-song-artist">🎤 ${song.artist || '-'}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

// ==========================================
// 🎵 ระบบควบคุมเพลงใน Live Activity
// ==========================================
window.toggleLivePlay = function() {
    if (!window.ytPlayer || typeof window.ytPlayer.getPlayerState !== 'function') return;
    const state = window.ytPlayer.getPlayerState();
    
    if (state === 1) { 
        window.ytPlayer.pauseVideo();
    } else { 
        window.ytPlayer.playVideo();
    }
}

window.nextLiveSong = function() {
    if (!window.songs || window.songs.length === 0 || !window.currentSongId) return;
    
    if (window.isShuffleEnabled) {
        let randomIndex = Math.floor(Math.random() * window.songs.length);
        if (window.songs.length > 1) {
            const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
            while (randomIndex === currentIdx) randomIndex = Math.floor(Math.random() * window.songs.length);
        }
        window.playSong(window.songs[randomIndex].id);
    } else {
        const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
        const nextIndex = currentIdx + 1 < window.songs.length ? currentIdx + 1 : 0;
        window.playSong(window.songs[nextIndex].id);
    }
}

window.prevLiveSong = function() {
    if (!window.songs || window.songs.length === 0 || !window.currentSongId) return;
    
    const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
    const prevIndex = currentIdx - 1 >= 0 ? currentIdx - 1 : window.songs.length - 1;
    window.playSong(window.songs[prevIndex].id);
}
