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
    if (!datalist) return; // ถ้าหาไม่เจอให้ข้ามไป

    const allSingers = new Set();
    
    // 1. ดึงรายชื่อจากที่เคยตั้งสีไว้
    if (window.SINGER_COLORS) {
        Object.keys(window.SINGER_COLORS).forEach(s => allSingers.add(s));
    }
    
    // 2. ดึงรายชื่อจากเพลงทั้งหมดที่มีในระบบ
    if (window.songs) {
        window.songs.forEach(song => {
            if (song.artist) song.artist.split(',').forEach(s => allSingers.add(s.trim()));
        });
    }

    // ล้างค่าเก่าทิ้งก่อน
    datalist.innerHTML = '';
    
    // สร้างตัวเลือก (Option) ใหม่ใส่เข้าไปเรียงตามตัวอักษร
    Array.from(allSingers).sort().forEach(singer => {
        if (singer && singer !== 'ดนตรี') {
            const option = document.createElement('option');
            option.value = singer;
            datalist.appendChild(option);
        }
    });
};

// ==========================================
// 🪟 Window Manager  (เพิ่มระบบบันทึกตำแหน่งและขนาด)
// ==========================================
window.wm = {
    libWin: null, playerWin: null, lyricsWin: null, settingsWin: null, addWin: null, adminSyncWin: null,

// 🧠 ระบบจำค่าและป้องกันหน้าต่างหาย (อัปเกรดเพิ่มระบบแอนิเมชันตอนปิด)
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

        // ==========================================
        // ✨ ส่วนที่เพิ่มใหม่: ระบบรอแอนิเมชันจบก่อนปิด
        // ==========================================
        const originalOnClose = options.onclose;
        options.onclose = function(force) {
            if (!force) {
                // 1. เติมคลาส .closing ให้หน้าต่างเริ่มเล่นแอนิเมชันหดตัว
                this.addClass('closing'); 
                
                // 2. ตั้งเวลาให้รอ 300ms (0.3 วินาที) แล้วค่อยสั่งลบหน้าต่างจริงๆ
                setTimeout(() => this.close(true), 300); 
                
                // 3. สั่งระงับการลบหน้าต่างทันทีไปก่อน
                return true; 
            }
            // ถ้า force = true แสดงว่ารอจบแล้ว ให้รันคำสั่ง onclose เดิมได้เลย
            if (originalOnClose) return originalOnClose.call(this, force);
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
                
                // หดพับ Live Activity เก็บ
                const liveAct = document.getElementById('liveActivity');
                const liveDiv = document.getElementById('dockDivider');
                if (liveAct) liveAct.classList.add('hidden');
                if (liveDiv) liveDiv.classList.add('hidden');
                
                // 🔴 ปิดภาพพื้นหลังปกเพลงให้จางหายไป
                const bgEl = document.getElementById('dynamic-bg');
                if (bgEl) bgEl.classList.remove('active');

                window.currentSongId = null;
                
                // 🔴 กางแถบสุ่มเพลงอัตโนมัติเมื่อปิดหน้าต่างเพลง
                if(window.setRandomPanelState) window.setRandomPanelState(true);
                // 🔴 สั่งปิดหน้าต่างเนื้อร้อง และหน้าต่างซิงค์ (ถ้าเปิดอยู่)
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
onAuthStateChanged(auth, async (user) => {  // 🔴 1. เติม async ตรงนี้
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
    
    document.getElementById('btnHeaderLogout').style.display = window.isLoggedIn ? 'block' : 'none';
    document.getElementById('btnHeaderLogin').style.display = window.isLoggedIn ? 'none' : 'block';
    document.getElementById('btnAddSong').style.display = window.isAdmin ? 'block' : 'none';
    
   // โชว์ปุ่ม Admin Sync เฉพาะตอนที่ล็อกอินแอดมิน
    document.getElementById('btnDockAdminSync').style.display = window.isAdmin ? 'block' : 'none';
    
    // ==========================================
    // 🔴 3.2 โค้ดใหม่: สร้างปุ่มตั้งค่าสีให้แอดมิน
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
    // ==========================================

    // 🔴 2. โหลดฐานข้อมูลสีให้เสร็จก่อน แล้วค่อยดึงเพลง
    await initializeSingerColors(db);
    
    fetchSongs(); 
});

window.loginWithGoogle = async function() { try { await signInWithPopup(auth, provider); } catch (e) { alert("เข้าสู่ระบบไม่สำเร็จ"); } }
window.logout = async function() { if(confirm('ต้องการออกจากระบบใช่หรือไม่?')) { await signOut(auth); } }

// ==========================================
// 🎵 ฟังก์ชันดึงข้อมูลเพลงทั้งหมดจากฐานข้อมูล (Firebase)
// ทำหน้าที่: โหลดเพลง, อัปเดตหน้าจอ, เช็คลิงก์, และจัดเตรียมข้อมูลต่างๆ
// ==========================================
async function fetchSongs() {
    // 1. เปิดหน้าจอโหลดดิ้ง (หมุนๆ) เพื่อให้ผู้ใช้รู้ว่าระบบกำลังทำงาน
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    try {
        // 2. ดึงข้อมูลทั้งหมดที่อยู่ในแฟ้ม 'songs' จากฐานข้อมูล
        const querySnapshot = await getDocs(songsCollection);
        
        // 3. เคลียร์คลังเพลงในระบบให้ว่างเปล่าก่อนเพื่อเตรียมรับข้อมูลใหม่
        window.songs = [];
        
        // 4. วนลูปเอาข้อมูลเพลงที่ดึงมาได้ ยัดใส่เข้าไปในคลังเพลง (window.songs)
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
                createdAt: data.createdAt 
            });
        });
        
        // 5. โหลดเสร็จแล้ว ปิดหน้าจอโหลดดิ้งได้
        document.getElementById('loadingOverlay').style.display = 'none';
        
        // 6. สั่งให้ระบบสร้าง "แถบสุ่มเพลงน่าฟัง" (Widget ด้านขวา)
        window.renderRandomPlaylist();
        
        // 7. ปลุกระบบเช็คการแจ้งเตือนเพลงใหม่
        if(window.checkNewSongsNotification) {
            window.checkNewSongsNotification();
        }

        // 8. อัปเดตรายชื่อศิลปินอัตโนมัติ สำหรับใช้ตอนพิมพ์ค้นหาหรือเพิ่มเพลง
        if (window.updateArtistSuggestions) {
            window.updateArtistSuggestions();
        }
    
        // 9. เช็คว่าผู้ใช้เข้าเว็บผ่านลิงก์แชร์เพลงเฉพาะเจาะจงหรือไม่ (เช่น ?song=1234)
        const urlParams = new URLSearchParams(window.location.search);
        const songIdFromUrl = urlParams.get('song');
        
        if (songIdFromUrl) {
            // ถ้ามีลิงก์แชร์แนบมา ให้หาเพลงนั้นแล้วกดเล่นให้ทันที
            const foundSong = window.songs.find(s => s.id === songIdFromUrl);
            if (foundSong) { 
                window.playSong(foundSong.id); 
                return; // จบการทำงานตรงนี้เลย ไม่ต้องเปิดหน้าต่างคลังเพลง
            }
        }
        
        // 10. ถ้าเข้ามาแบบปกติ (ไม่มีลิงก์แชร์) ให้เปิดหน้าต่าง "คลังเพลง" ขึ้นมา
        window.wm.openLibrary(); 
        
    } catch (error) { 
        // กรณีดึงข้อมูลพัง (เช่น เน็ตหลุด) ให้ปิดหน้าจอโหลดดิ้ง เพื่อไม่ให้เว็บค้าง
        document.getElementById('loadingOverlay').style.display = 'none'; 
        console.error("Error fetching songs: ", error); // พิมพ์บอก Error ไว้ใน Console เผื่อแอดมินมาเช็ค
    }
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
        else { await addDoc(songsCollection, { title, artist, audioPath, lyrics, timestamps: [], singers: [], createdAt: Date.now() }); }
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
        
        // 🔴 เพิ่มการเรียงลำดับตัวอักษร (A-Z, ก-ฮ) ตรงนี้
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
window.renderLyricsToContainer = function() {
    const container = document.getElementById('lyricsContainer'); if(!container) return;
    container.innerHTML = ''; if (window.currentLyricsArray.length === 0) { container.innerHTML = 'ไม่มีเนื้อเพลง'; return; }
    const song = window.songs.find(s => s.id === window.currentSongId);

    window.currentLyricsArray.forEach((lyric, index) => {
        const lineDiv = document.createElement('div'); lineDiv.className = 'lyric-line'; lineDiv.id = `lyric-line-${index}`;
        // 🔴 ฟีเจอร์กดเนื้อเพลงแล้ววาร์ป (Seek)
        lineDiv.onclick = () => {
            const song = window.songs.find(s => s.id === window.currentSongId);
            // ตรวจสอบว่าเพลงนี้มีเวลาถูกเซ็ตไว้แล้ว และ Player พร้อมทำงาน
            if (song && song.timestamps && song.timestamps[index] != null && window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
                window.ytPlayer.seekTo(song.timestamps[index], true);
                
                // อัปเดต UI ทันทีให้ผู้ใช้รู้ว่ากดติดแล้ว (ไม่ต้องรอรอบ Sync)
                window.currentLyricIndex = index;
                window.updateLyricDisplay();
            }
        };
        let linesHtml = "";
        const cleanLyric = lyric.trim();
        
       // 🔴 เช็คว่าถ้าแอดมินพิมพ์คำว่า [ดนตรี] ให้เปลี่ยนเป็นตัวโน้ตกระพริบ
        if (cleanLyric === '[ดนตรี]') {
            linesHtml = `
                <div class="lyric-instrumental">
                    <span class="note">🎵</span>
                    <span class="note">🎶</span>
                    <span class="note">🎵</span>
                </div>
            `;
        } else {
            // 🔴 ถ้าเป็นเนื้อร้องปกติ ให้เช็คสัญลักษณ์ ||
            linesHtml = lyric.split('\n').map((l, i) => {
                if (l.includes('||')) {
                    // ถ้าเจอ || ให้หั่นเป็น 2 ท่อน แล้วใส่คลาส dual-lyric
                    let parts = l.split('||');
                    let mainText = parts[0].trim();
                    let subText = parts[1].trim();
                    return `<div class="lang-${i} dual-lyric"><span class="lyric-main">${mainText}</span><span class="lyric-sub">${subText}</span></div>`;
                } else {
                    // ✅ ปลอดภัย 100%: ถ้าไม่มี || ก็แสดงผลด้วยโครงสร้างเก่าเป๊ะๆ
                    return `<div class="lang-${i}">${l}</div>`;
                }
            }).join('');
        }

        const singerString = (song && song.singers && song.singers[index]) ? song.singers[index] : null;

    if (singerString && cleanLyric !== '[ดนตรี]') { 
            const badgesHtml = singerString.split(',').filter(s=>s.trim()).map(s => {
                const name = s.trim();
                // 🔴 ดึงสีมาจากฐานข้อมูล (ถ้าไม่เจอใครให้ใช้สีฟ้า default)
                // เพิ่มเช็คเผื่อ window.SINGER_COLORS ยังโหลดไม่เสร็จ
                const colorsDict = window.SINGER_COLORS || {};
                const badgeColor = colorsDict[name] || '#0a84ff';
                
                // ใส่สไตล์สีลงไปในป้ายชื่อ
                return `<span class="singer-badge" style="background-color: ${badgeColor}; color: #fff; border: 1px solid rgba(255,255,255,0.2);">${name}</span>`;
            }).join('');
            lineDiv.innerHTML = `<div class="singer-badges">${badgesHtml}</div>${linesHtml}`;
        } else { 
            lineDiv.innerHTML = linesHtml; 
        }
        
        container.appendChild(lineDiv);
    });
}
window.playSong = function(id) {
    window.currentSongId = id; const song = window.songs.find(s => s.id === id); if (!song) return;
    
    // 🔴 ฟังชั่นหุบแถบอัตโนมัติ
    if(window.setRandomPanelState) window.setRandomPanelState(false);
    if(window.wm && window.wm.notifyWin) window.wm.notifyWin.close();
    
    // โชว์และอัปเดต Live Activity
    const liveAct = document.getElementById('liveActivity');
    const liveDiv = document.getElementById('dockDivider');
    if (liveAct && liveDiv) {
        document.getElementById('liveTitle').innerText = song.title;
        document.getElementById('liveArtist').innerText = '🎤 ' + (song.artist || '-');
        liveAct.classList.remove('hidden');
        liveDiv.classList.remove('hidden');
    }

    window.currentLyricsArray = song.lyrics.split(/\n\s*\n/); window.currentLyricIndex = -1;
    
    window.wm.openPlayer(song.title); window.wm.openLyrics(song.title);
    if (window.wm.adminSyncWin) window.wm.adminSyncWin.setTitle("⏱ ซิงค์: " + song.title); 

    window.renderTimestampEditor(); window.renderLyricsToContainer(); window.updateLyricDisplay();

    const videoId = window.extractYouTubeID(song.audioPath);
    const bgEl = document.getElementById('dynamic-bg');
    if (bgEl && videoId) { bgEl.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`; bgEl.classList.add('active'); }
    
    // เช็คและสร้างกล่อง YouTube ใหม่
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
        const currentSong = window.songs.find(s => s.id === window.currentSongId); 
        if (!currentSong || !currentSong.timestamps) return;
        const currentTime = window.ytPlayer.getCurrentTime(); 
        if (currentTime === undefined || currentTime === 0) return;

        let correctIndex = -1;
        for (let i = 0; i < currentSong.timestamps.length; i++) {
            if (currentSong.timestamps[i] != null && currentTime >= currentSong.timestamps[i]) {
                correctIndex = i;
            }
        }
        
        if (window.currentLyricIndex !== correctIndex) {
            window.currentLyricIndex = correctIndex;
            window.updateLyricDisplay();
        }
    }, 100); 
}; 

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
            const dropdown = document.createElement('div'); dropdown.className = 'ts-singer-dropdown'; dropdown.style.position = 'relative';
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
    e.stopPropagation(); 
    const isShowing = menu.classList.contains('show'); 
    document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    
    if (!isShowing) { 
        menu.classList.add('show'); 
        const rect = toggleBtn.getBoundingClientRect(); 
        
        // เปลี่ยนจาก fixed เป็น absolute เพื่อไม่ให้หลุดกรอบ
        menu.style.position = 'absolute'; 
        menu.style.left = '0'; 
        
        // 🔴 เช็คว่าพื้นที่ด้านล่างเหลือพอกางเมนูไหม (ถ้าน้อยกว่า 200px ให้เด้งขึ้นบนแทน)
        if (window.innerHeight - rect.bottom < 200) {
            menu.style.top = 'auto';
            menu.style.bottom = 'calc(100% + 5px)'; // เด้งขึ้นบน
        } else {
            menu.style.top = 'calc(100% + 5px)';    // กางลงล่างปกติ
            menu.style.bottom = 'auto';
        }
    }
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
    window.syncTimestampEditorUI(); 
}

window.nextLyric = function(isAuto = false) {
    if (window.currentLyricIndex < window.currentLyricsArray.length) {
        window.currentLyricIndex++; 
        window.updateLyricDisplay();
        
        if (!isAuto && window.isAdmin && window.currentSongId && window.ytPlayer) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) { 
                if (!song.timestamps) song.timestamps = []; 
                const currentTime = window.ytPlayer.getCurrentTime();
                song.timestamps[window.currentLyricIndex] = currentTime; 
                
                // ✨ ส่วนที่เพิ่ม: อัปเดตตัวเลขในกล่องเวลาบนหน้าจอทันที ✨
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
            if (song && song.timestamps) { 
                song.timestamps[window.currentLyricIndex] = null; 
                
                // ✨ ส่วนที่เพิ่ม: เคลียร์ตัวเลขในกล่องเวลาเมื่อกดถอยหลัง ✨
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
                
                // 🔴 กางแถบสุ่มเพลงอัตโนมัติเพื่อรอให้ผู้ใช้เลือกเพลงใหม่
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

// โหลดค่า Custom ทั้งหมดตอนเปิดแอป
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

// 🔴 ฟังก์ชันเปิด/ปิดโหมดสุ่มเพลง
window.isShuffleEnabled = false;

window.toggleShuffle = function(isEnable) {
    window.isShuffleEnabled = isEnable;
    localStorage.setItem('ws_shuffle', isEnable ? '1' : '0');
}

// สั่งให้โหลดค่าทันทีเมื่อเปิดเว็บ
document.addEventListener('DOMContentLoaded', () => {
    window.loadCustomSettings();
});

// ==========================================
// 🎲 ระบบแถบสุ่มเพลงด้านขวา (Widget)
// ==========================================
// 🔴 ฟังก์ชันใหม่สำหรับสั่งกาง/หุบ แถบแบบเจาะจง
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

// อัปเดตปุ่มกดให้เรียกใช้ฟังก์ชันใหม่
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
    
    if (state === 1) { // ถ้ากำลังเล่นอยู่
        window.ytPlayer.pauseVideo();
    } else { // ถ้าหยุดพักอยู่
        window.ytPlayer.playVideo();
    }
}

window.nextLiveSong = function() {
    if (!window.songs || window.songs.length === 0 || !window.currentSongId) return;
    
    // ถ้าเปิดโหมดสุ่ม ให้สุ่มเพลง
    if (window.isShuffleEnabled) {
        let randomIndex = Math.floor(Math.random() * window.songs.length);
        if (window.songs.length > 1) {
            const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
            while (randomIndex === currentIdx) randomIndex = Math.floor(Math.random() * window.songs.length);
        }
        window.playSong(window.songs[randomIndex].id);
    } else {
        // ถ้าโหมดปกติ ให้เล่นเพลงถัดไป (ถ้าหมดจะวนกลับเพลงแรก)
        const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
        const nextIndex = currentIdx + 1 < window.songs.length ? currentIdx + 1 : 0;
        window.playSong(window.songs[nextIndex].id);
    }
}

window.prevLiveSong = function() {
    if (!window.songs || window.songs.length === 0 || !window.currentSongId) return;
    
    const currentIdx = window.songs.findIndex(s => s.id === window.currentSongId);
    // ถอยกลับ 1 เพลง (ถ้าอยู่เพลงแรก จะวนไปเพลงสุดท้าย)
    const prevIndex = currentIdx - 1 >= 0 ? currentIdx - 1 : window.songs.length - 1;
    window.playSong(window.songs[prevIndex].id);
}

