import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeSingerColors, openSingerColorManager } from './singerColors.js';

window.setDoc = setDoc; 
window.getDoc = getDoc;

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
                covers: data.covers || [],
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
        
      // 🟢 ตรวจสอบลิงก์แชร์ ถ้าไม่มีการเล่นเพลงจากลิงก์ ถึงจะเปิดคลังเพลงขึ้นมา
        const isSongPlayed = window.checkSharedLink();
        
        if (!isSongPlayed) {
            window.wm.openLibrary(); 
        }
        
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
       // 🟢 สร้างตัวแปรหลีกเลี่ยงชื่อเพลงที่มี ' (Single Quote) ทำให้โค้ดพัง
        const safeTitle = song.title.replace(/'/g, "\\'"); 
        
        item.innerHTML = `
            <img src="${thumbUrl}" onerror="this.style.display='none'">
            <div><div class="song-title">${song.title}</div><div class="song-artist">🎤 ${song.artist || '-'}</div></div>
            <div class="song-actions">
                <button class="btn-primary" onclick="playSong('${song.id}')">▶ เล่น</button>
                <button class="share-btn" onclick="copyShareLink('${safeTitle}', this)">🔗 แชร์</button>
                ${actionsHtml}
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// ==========================================
// ระบบเล่นเพลง & จัดการเวลา (Full Admin Controls)
// ==========================================

window.getActiveTimestamps = function(song) {
    if (!song) return [];
    if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
        const coverTs = song.covers[window.currentCoverIndex].timestamps;
        if (coverTs && coverTs.some(t => t != null)) return coverTs; 
    }
    return song.timestamps || []; 
};

window.getActiveSingers = function(song) {
    if (!song) return [];
    if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
        const coverSg = song.covers[window.currentCoverIndex].singers;
        if (coverSg && coverSg.some(s => s !== "")) return coverSg;
    }
    return song.singers || [];
};

window.renderLyricsToContainer = function() {
    const container = document.getElementById('lyricsContainer'); if(!container) return;
    container.innerHTML = ''; if (window.currentLyricsArray.length === 0) { container.innerHTML = 'ไม่มีเนื้อเพลง'; return; }
    const song = window.songs.find(s => s.id === window.currentSongId);

    window.currentLyricsArray.forEach((lyric, index) => {
        const lineDiv = document.createElement('div'); lineDiv.className = 'lyric-line'; lineDiv.id = `lyric-line-${index}`;
        
        lineDiv.onclick = () => {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song && window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
                const activeTimestamps = window.getActiveTimestamps(song);
                if (activeTimestamps[index] != null) {
                    window.ytPlayer.seekTo(activeTimestamps[index], true);
                    window.currentLyricIndex = index;
                    window.updateLyricDisplay();
                }
            }
        };
        
        let linesHtml = "";
        const cleanLyric = lyric.trim();
        
        if (cleanLyric === '[ดนตรี]') {
            linesHtml = `
                <div class="lyric-instrumental">
                    <span class="note">🎵</span><span class="note">🎶</span><span class="note">🎵</span>
                </div>
            `;
        } else {
            const validLines = cleanLyric.split('\n').filter(l => l.trim() !== '');
            linesHtml = validLines.map((l, i) => {
                const isMiddle = (i > 0 && i < validLines.length - 1);
                const highlightClass = isMiddle ? ' reading-text' : ''; 
                if (l.includes('||')) {
                    let parts = l.split('||');
                    return `<div class="lang-${i} dual-lyric${highlightClass}"><span class="lyric-main">${parts[0].trim()}</span><span class="lyric-sub">${parts[1].trim()}</span></div>`;
                } else {
                    return `<div class="lang-${i}${highlightClass}">${l}</div>`;
                }
            }).join('');
        }

        const activeSingers = window.getActiveSingers(song);
        const singerString = activeSingers[index] || null;

        if (singerString && cleanLyric !== '[ดนตรี]') { 
            const badgesHtml = singerString.split(',').filter(s=>s.trim()).map(s => {
                const name = s.trim();
                const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[name]) ? window.SINGER_COLORS[name] : '#0a84ff';
                return `<span class="singer-badge" style="background-color: ${badgeColor}; color: #fff; border: 1px solid rgba(255,255,255,0.2);">${name}</span>`;
            }).join('');
            lineDiv.innerHTML = `<div class="singer-badges">${badgesHtml}</div>${linesHtml}`;
        } else { 
            lineDiv.innerHTML = linesHtml; 
        }
        
        container.appendChild(lineDiv);
    });
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

window.saveTimestampsToFirebase = async function(updateLyricsText = false) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song) return;

    if (updateLyricsText) song.lyrics = window.currentLyricsArray.join('\n\n');
    const count = window.currentLyricsArray.length;
    
    let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);

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

    // ==========================================
    // 🟢 แถบ Calibrate หูฟังบลูทูธ (จดจำแยกเครื่องลง localStorage)
    // ==========================================
    if (window.isAdmin) {
        const savedOffset = localStorage.getItem('admin_audio_offset') || '0';
        const offsetDiv = document.createElement('div');
        offsetDiv.style.cssText = 'background: rgba(255, 159, 10, 0.15); border: 1px solid rgba(255, 159, 10, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;';
        offsetDiv.innerHTML = `
            <div>
                <div style="color: #ff9f0a; font-weight: bold; font-size: 0.9em;">🎧 Calibrate หูฟังไร้สาย</div>
                <div style="color: #aaa; font-size: 0.8em; margin-top: 2px;">หักลบความหน่วง (Latency) ออกจากเวลาจริง</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button onclick="window.startCalibration()" style="background: rgba(10, 132, 255, 0.2); color: #0a84ff; border: 1px solid rgba(10, 132, 255, 0.5); border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 0.85em; font-weight: bold;">🎯 จับจังหวะอัตโนมัติ</button>
                <div style="display:flex; align-items:center; gap:3px;">
                    <input type="number" id="adminAudioOffset" value="${savedOffset}" step="10" min="0" style="width: 65px; padding: 4px; text-align: center; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.5); color: #fff; margin: 0;">
                    <span style="color: #ff9f0a; font-size: 0.85em;">ms</span>
                </div>
            </div>
        `;
        container.appendChild(offsetDiv);

        setTimeout(() => {
            const offsetInput = document.getElementById('adminAudioOffset');
            if (offsetInput) {
                offsetInput.addEventListener('change', (e) => {
                    localStorage.setItem('admin_audio_offset', Math.max(0, parseInt(e.target.value) || 0));
                });
            }
        }, 50);
    }

    let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
    
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

// 🟢 ระบบหักลบความหน่วง (Calibrate) ทำงานตรงฟังก์ชันนี้
window.nextLyric = function(isAuto = false) {
    if (window.currentLyricIndex < window.currentLyricsArray.length) {
        window.currentLyricIndex++; 
        window.updateLyricDisplay();
        
        if (!isAuto && window.isAdmin && window.currentSongId && window.ytPlayer) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) { 
                
                // คำนวณหักลบเวลาความหน่วง
                const offsetMs = parseInt(localStorage.getItem('admin_audio_offset')) || 0;
                const rawTime = window.ytPlayer.getCurrentTime();
                const currentTime = Math.max(0, rawTime - (offsetMs / 1000));
                
                let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);

                if (isCover) {
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
    const playPauseBtn = document.getElementById('livePlayPauseBtn');
    if (event.data === 1 && playPauseBtn) playPauseBtn.innerText = '⏸'; 
    if (event.data === 2 && playPauseBtn) playPauseBtn.innerText = '▶'; 

    if (event.data === 0) { 
        if (!window.songs || window.songs.length === 0) return;

        if (window.isShuffleEnabled) {
            let randomIndex = Math.floor(Math.random() * window.songs.length);
            if (window.songs.length > 1) {
                const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
                while (randomIndex === currentIdx) {
                    randomIndex = Math.floor(Math.random() * window.songs.length);
                }
            }
            window.playSong(window.songs[randomIndex].id);
        } else {
            const idx = window.songs.findIndex(s => s.id === window.currentSongId);
            if (idx !== -1 && idx + 1 < window.songs.length) {
                window.playSong(window.songs[idx + 1].id);
            } else {
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

// ==========================================
// 🎯 ระบบ Auto Calibration (จับจังหวะเสียงหาความหน่วง Bluetooth)
// ==========================================
window.startCalibration = function() {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    if (!actx) return alert("เบราว์เซอร์ไม่รองรับระบบนี้ แนะนำให้พิมพ์ตัวเลขเองครับ");

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;';
    
    overlay.innerHTML = `
        <h2 style="color:#0a84ff; margin-bottom: 10px;">🎯 ทดสอบความหน่วงหูฟัง</h2>
        <p style="color:#aaa; text-align:center; max-width:400px; line-height:1.6; margin-bottom:30px;">
            ระบบจะส่งเสียง "ติ๊ด" เป็นจังหวะจำนวน 4 ครั้ง <br>
            ให้คุณ <b>กดปุ่ม Spacebar หรือคลิกปุ่มด้านล่าง</b> <br>ให้ตรงกับเสียงที่ได้ยินเป๊ะๆ เพื่อคำนวณความหน่วง
        </p>
        <div id="calibBtn" style="width:140px; height:140px; border-radius:50%; background:#0a84ff; display:flex; align-items:center; justify-content:center; font-size:2em; font-weight:bold; cursor:pointer; user-select:none; box-shadow:0 10px 30px rgba(10,132,255,0.4); transition:transform 0.1s;">
            👆 กด!
        </div>
        <div id="calibStatus" style="margin-top: 35px; font-size: 1.2em; font-weight: bold; color: #ffcc00;">แตะหน้าจอ 1 ครั้งเพื่อเริ่ม...</div>
        <button id="calibCancel" style="margin-top:40px; background:transparent; border:1px solid #ff3b30; color:#ff3b30; padding:8px 25px; border-radius:20px; cursor:pointer;">ยกเลิก</button>
    `;
    document.body.appendChild(overlay);

    const btn = overlay.querySelector('#calibBtn');
    const status = overlay.querySelector('#calibStatus');
    let expectedTimes = [];
    let tapTimes = [];
    let isStarted = false;
    let totalBeeps = 4;

    const startTest = () => {
        if(actx.state === 'suspended') actx.resume();
        status.style.color = "#34c759";
        status.innerText = "เตรียมตัว... (3)";
        
        setTimeout(() => status.innerText = "เตรียมตัว... (2)", 600);
        setTimeout(() => status.innerText = "เตรียมตัว... (1)", 1200);

        setTimeout(() => {
            status.innerText = "🎵 ฟังจังหวะแล้วกดเลย!";
            let startTime = actx.currentTime + 0.5;
            
            for(let i=0; i<totalBeeps; i++) {
                let timeToPlay = startTime + i;
                expectedTimes.push(timeToPlay);
                
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.type = 'sine';
                osc.frequency.value = 880; 
                
                gain.gain.setValueAtTime(1, timeToPlay);
                gain.gain.exponentialRampToValueAtTime(0.001, timeToPlay + 0.1);
                
                osc.start(timeToPlay);
                osc.stop(timeToPlay + 0.1);
            }
        }, 1800);
    };

    const handleTap = (e) => {
        if (e.type === 'keydown' && e.code !== 'Space') return;
        e.preventDefault();

        if (!isStarted) {
            isStarted = true;
            startTest();
            return;
        }

        if (tapTimes.length >= totalBeeps) return;

        tapTimes.push(actx.currentTime);

        btn.style.transform = 'scale(0.85)';
        btn.style.background = '#34c759';
        setTimeout(() => { btn.style.transform = 'scale(1)'; btn.style.background = '#0a84ff'; }, 100);

        if (tapTimes.length === totalBeeps) {
            calculateResult();
        }
    };

    const calculateResult = () => {
        let totalLatency = 0;
        let validTaps = 0;

        for (let i = 0; i < totalBeeps; i++) {
            let diff = tapTimes[i] - expectedTimes[i];
            
            if (diff > -0.2 && diff < 1.0) {
                totalLatency += diff;
                validTaps++;
            }
        }
        
        if (validTaps === 0) {
            status.style.color = "#ff3b30";
            status.innerText = "❌ จับจังหวะไม่สำเร็จ ลองใหม่อีกครั้ง";
            setTimeout(() => { document.body.removeChild(overlay); }, 2000);
            return;
        }

        let avgLatencyMs = Math.round((totalLatency / validTaps) * 1000);
        avgLatencyMs = Math.max(0, avgLatencyMs); 

        status.style.color = "#ffcc00";
        status.innerText = `✅ ตรวจพบความหน่วง: ${avgLatencyMs} ms`;

        localStorage.setItem('admin_audio_offset', avgLatencyMs);
        const inputOffset = document.getElementById('adminAudioOffset');
        if (inputOffset) inputOffset.value = avgLatencyMs;

        btn.style.display = 'none';
        setTimeout(() => { document.body.removeChild(overlay); }, 2000);
    };

    overlay.addEventListener('mousedown', (e) => { if (e.target.id !== 'calibCancel') handleTap(e); });
    window.addEventListener('keydown', handleTap);
    
    overlay.querySelector('#calibCancel').onclick = () => { document.body.removeChild(overlay); };
    const observer = new MutationObserver(() => {
        if (!document.body.contains(overlay)) { window.removeEventListener('keydown', handleTap); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
};

// ==========================================
// 🔗 ระบบ Share Link (Dynamic Slug)
// ==========================================
window.createCleanSlug = function(title) {
    if (!title) return "";
    let slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || "track-" + Math.floor(Math.random() * 10000);
};

window.checkSharedLink = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackSlug = urlParams.get('track');

    if (trackSlug && window.songs) {
        const targetSong = window.songs.find(s => window.createCleanSlug(s.title) === trackSlug);
        if (targetSong) {
            if (typeof window.playSong === 'function') window.playSong(targetSong.id);
            return true; // 🟢 เพิ่มบรรทัดนี้: ส่งสัญญาณว่าเปิดเพลงสำเร็จแล้ว
        }
    }
    return false; // 🟢 เพิ่มบรรทัดนี้: ส่งสัญญาณว่าไม่เจอเพลงจากลิงก์
};

window.copyShareLink = function(songTitle, buttonElement) {
    const slug = window.createCleanSlug(songTitle);
    const shareUrl = `${window.location.origin}${window.location.pathname}?track=${slug}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        showShareToast('✅ คัดลอกลิงก์เพลงแล้ว!');
        if(buttonElement) {
            const originalText = buttonElement.innerHTML;
            buttonElement.innerHTML = '✨ ก๊อปปี้แล้ว!';
            buttonElement.style.color = '#00d2ff';
            setTimeout(() => { buttonElement.innerHTML = originalText; buttonElement.style.color = ''; }, 2000);
        }
    });
};

function showShareToast(message) {
    let toast = document.getElementById('share-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'share-toast';
        toast.style.cssText = `position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(10, 132, 255, 0.9); color: white; padding: 10px 20px; border-radius: 30px; font-size: 14px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; opacity: 0; transition: opacity 0.3s ease, bottom 0.3s ease; pointer-events: none;`;
        document.body.appendChild(toast);
    }
    toast.innerText = message; toast.style.opacity = '1'; toast.style.bottom = '50px';
    setTimeout(() => { toast.style.opacity = '0'; toast.style.bottom = '30px'; }, 2500);
}
