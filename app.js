import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ----------------------------------------------------
const ALLOWED_EMAILS = ["sashikiwa@gmail.com", "panupong.bb27115@gmail.com"]; 
// ----------------------------------------------------

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
window.currentFilter = 'All'; // ตัวแปรเก็บสถานะศิลปินที่เลือกปัจจุบัน

window.onYouTubeIframeAPIReady = function() {
    window.isYTApiReady = true; 
};

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
} else {
    document.head.appendChild(tag);
}

onAuthStateChanged(auth, (user) => {
    window.isLoggedIn = !!user;
    window.isAdmin = user && ALLOWED_EMAILS.includes(user.email);
    
    if (window.isLoggedIn) {
        document.getElementById('btnHeaderLogout').style.display = 'block';
        document.getElementById('btnHeaderLogin').style.display = 'none';
    } else {
        document.getElementById('btnHeaderLogout').style.display = 'none';
        document.getElementById('btnHeaderLogin').style.display = 'block';
    }

    if (window.isAdmin && document.getElementById('view-list').classList.contains('active')) {
        document.getElementById('btnAddSong').style.display = 'block';
    } else {
        document.getElementById('btnAddSong').style.display = 'none';
    }
    
    fetchSongs(); 
});

window.loginWithGoogle = async function() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Error:", error);
        alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
    }
}

window.logout = async function() {
    if(confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
        try {
            await signOut(auth);
            if (window.ytPlayer && typeof window.ytPlayer.stopVideo === 'function') {
                window.ytPlayer.stopVideo();
            }
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }
}

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
                timestamps: data.timestamps || []
            });
        });
        document.getElementById('loadingOverlay').style.display = 'none';
        
        if (!document.getElementById('view-player').classList.contains('active') && 
            !document.getElementById('view-add').classList.contains('active')) {
            window.showView('view-list');
        } else {
            window.renderSongList();
        }
    } catch (error) {
        console.error("Error fetching songs:", error);
        alert("เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Rules ว่าอนุญาตให้อ่านข้อมูลได้หรือไม่");
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

window.extractYouTubeID = function(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    const headerTitle = document.getElementById('headerTitle');
    if (viewId === 'view-list') {
        headerTitle.innerText = 'คลังเพลงของฉัน';
        document.getElementById('btnAddSong').style.display = window.isAdmin ? 'block' : 'none';
        
        const searchInput = document.getElementById('searchInput');
        if(searchInput) searchInput.value = '';
        
        window.currentFilter = 'All'; // รีเซ็ตฟิลเตอร์เมื่อกลับหน้าแรก
        window.renderSongList();
        clearInterval(window.syncInterval);
        window.currentSongId = null;
        if (window.ytPlayer && typeof window.ytPlayer.stopVideo === 'function') {
            window.ytPlayer.stopVideo();
        }
    } else if (viewId === 'view-player') {
        headerTitle.innerText = 'กำลังเล่นเพลง';
        
        const lyricControlBtnGroup = document.getElementById('lyricControlBtnGroup');
        const timestampEditorSection = document.getElementById('timestampEditorSection');
        const btnResetSync = document.getElementById('btnResetSync');

        // ตรวจสอบสิทธิ์ Admin เพื่อซ่อนหรือแสดงเครื่องมือแก้ไข
        if (window.isAdmin) {
            if(lyricControlBtnGroup) lyricControlBtnGroup.style.display = 'flex';
            if(timestampEditorSection) timestampEditorSection.style.display = 'block';
            if(btnResetSync) btnResetSync.style.display = 'block';
            
            document.getElementById('tsEditorTitle').innerText = "⏱ แก้ไข Timestamp (วินาที)";
            document.getElementById('tsEditorSub').innerText = "พิมพ์แก้ไขตัวเลขได้ทันที (Admin)";
            document.getElementById('tsEditorSub').style.color = "#0a84ff";
        } else {
            if(lyricControlBtnGroup) lyricControlBtnGroup.style.display = 'none';
            if(timestampEditorSection) timestampEditorSection.style.display = 'none';
            if(btnResetSync) btnResetSync.style.display = 'none';
        }
    }
}

window.openAddView = function() {
    if (!window.isAdmin) return;
    window.editingSongId = null;
    document.getElementById('headerTitle').innerText = 'เพิ่มเพลงใหม่';
    document.getElementById('inputTitle').value = '';
    document.getElementById('inputArtist').value = '';
    document.getElementById('inputAudio').value = '';
    document.getElementById('inputLyrics').value = '';
    window.showView('view-add');
}

window.editSong = function(id) {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === id);
    if (!song) return;

    window.editingSongId = id;
    document.getElementById('headerTitle').innerText = 'แก้ไขเพลง';
    document.getElementById('inputTitle').value = song.title;
    document.getElementById('inputArtist').value = song.artist || '';
    document.getElementById('inputAudio').value = song.audioPath;
    document.getElementById('inputLyrics').value = song.lyrics;
    window.showView('view-add');
}

window.saveSong = async function() {
    if (!window.isAdmin) {
        alert("ต้องเข้าสู่ระบบด้วยอีเมล Admin ก่อนจึงจะบันทึกได้ครับ");
        return;
    }
    
    const title = document.getElementById('inputTitle').value.trim();
    const artist = document.getElementById('inputArtist').value.trim();
    const audioPath = document.getElementById('inputAudio').value.trim();
    const lyrics = document.getElementById('inputLyrics').value.trim();
    const btnSave = document.getElementById('btnSave');

    if (!title || !lyrics) {
        alert("กรุณากรอกชื่อเพลงและเนื้อเพลงครับ");
        return;
    }

    if (!window.extractYouTubeID(audioPath)) {
        alert("ลิงก์ YouTube ไม่ถูกต้อง");
        return;
    }

    btnSave.disabled = true;
    btnSave.innerText = "กำลังบันทึก...";

    try {
        if (window.editingSongId) {
            const songRef = doc(db, "songs", window.editingSongId);
            await updateDoc(songRef, { title, artist, audioPath, lyrics });
        } else {
            await addDoc(songsCollection, { title, artist, audioPath, lyrics, timestamps: [] });
        }
        
        await fetchSongs();
        window.showView('view-list'); 

    } catch (e) {
        console.error(e);
        alert("บันทึกไม่สำเร็จ");
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = "💾 บันทึกเพลง";
        window.editingSongId = null;
    }
}

// ----------------------------------------------------
// ระบบ Filter & ค้นหา
// ----------------------------------------------------

// --- 1. เพิ่มฟังก์ชันสำหรับปุ่มย่อ/ขยาย หมวดหมู่ศิลปิน ---
window.toggleArtistFilter = function() {
    const chipContainer = document.getElementById('artistChips');
    const btn = document.getElementById('btnToggleArtists');
    if (chipContainer.classList.contains('expanded')) {
        chipContainer.classList.remove('expanded');
        btn.innerText = '🔽 ขยาย';
    } else {
        chipContainer.classList.add('expanded');
        btn.innerText = '🔼 ย่อ';
    }
}

window.filterByArtist = function(artistName) {
    window.currentFilter = artistName;
    const query = document.getElementById('searchInput').value.toLowerCase();
    window.renderSongList(query, artistName);
}

window.filterSongs = function() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    window.renderSongList(query, window.currentFilter);
}

// --- 2. อัปเดตฟังก์ชัน renderSongList เพื่อเพิ่มระบบ Sort ---
window.renderSongList = function(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList');
    const chipContainer = document.getElementById('artistChips');
    listContainer.innerHTML = '';

    // สร้างปุ่มลัดชื่อศิลปินอัตโนมัติ โดยเรียงลำดับตัวอักษรศิลปินด้วย
    if (chipContainer) {
        let uniqueArtists = [...new Set(window.songs.map(s => s.artist || 'ไม่ระบุศิลปิน'))];
        uniqueArtists.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        
        const artists = ['All', ...uniqueArtists];
        chipContainer.innerHTML = artists.map(a => 
            `<button class="chip ${artistFilter === a ? 'active' : ''}" onclick="filterByArtist('${a}')">${a === 'All' ? 'ทั้งหมด' : a}</button>`
        ).join('');
    }

    // กรองข้อมูลตามที่ค้นหา + ศิลปินที่เลือก
    let filteredSongs = window.songs.filter(song => {
        const q = query.toLowerCase();
        const artist = song.artist || 'ไม่ระบุศิลปิน';
        const titleMatch = song.title && song.title.toLowerCase().includes(q);
        const artistMatch = artist.toLowerCase().includes(q);
        const artistFilterMatch = (artistFilter === 'All' || artist === artistFilter);
        
        return (titleMatch || artistMatch) && artistFilterMatch;
    });

    // --- ส่วนเพิ่ม: จัดเรียง A-Z (ศิลปิน -> ชื่อเพลง) ---
    filteredSongs.sort((a, b) => {
        const artistA = (a.artist || 'ไม่ระบุศิลปิน').toLowerCase();
        const artistB = (b.artist || 'ไม่ระบุศิลปิน').toLowerCase();
        
        // เรียงตามศิลปินก่อน
        if (artistA < artistB) return -1;
        if (artistA > artistB) return 1;
        
        // ถ้าศิลปินเดียวกัน ให้เรียงตามชื่อเพลง
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        
        if (titleA < titleB) return -1;
        if (titleA > titleB) return 1;
        
        return 0;
    });

    if (filteredSongs.length === 0) {
        listContainer.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center; margin-top:40px;">' + (window.songs.length === 0 ? 'ยังไม่มีเพลงในคลัง' : 'ไม่พบเพลงที่ค้นหา') + '</p>';
        return;
    }

    // นำ filteredSongs มาแสดงผล...
    // (โค้ดส่วนแสดงผลการ์ดเพลงต่อจากนี้ใช้ของเดิมของคุณได้เลยครับ)
    filteredSongs.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-item';
        
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        
        let actionsHtml = '';
        if (window.isAdmin) {
            actionsHtml = `
                <button class="btn-action btn-secondary" onclick="editSong('${song.id}')">✏️</button>
                <button class="btn-action btn-secondary" style="background:rgba(229, 57, 53, 0.2); border-color:rgba(229, 57, 53, 0.4); color:#ef5350;" onclick="deleteSong('${song.id}')">ลบ</button>
            `;
        }
        
        item.innerHTML = `
            <div class="song-info-wrapper">
                <img src="${thumbUrl}" class="song-thumbnail" onerror="this.style.display='none'" alt="Cover">
                <div class="song-item-title-container">
                    <div class="song-item-title">
                        ${song.title}
                        <span style="font-size: 0.85em; color: #8e8e93; display: block; margin-top: 4px;">🎤 ${song.artist || 'ไม่ระบุศิลปิน'}</span>
                    </div>
                </div>
            </div>
            <div class="song-item-actions">
                <button class="btn-action" style="background: #0a84ff; color: white;" onclick="playSong('${song.id}')">▶ เล่น</button>
                ${actionsHtml}
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// ----------------------------------------------------
// ระบบ Filter & ค้นหา
// ----------------------------------------------------
window.filterByArtist = function(artistName) {
    window.currentFilter = artistName;
    const query = document.getElementById('searchInput').value.toLowerCase();
    window.renderSongList(query, artistName);
}

window.filterSongs = function() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    window.renderSongList(query, window.currentFilter);
}

window.renderSongList = function(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList');
    const chipContainer = document.getElementById('artistChips');
    listContainer.innerHTML = '';

    // สร้างปุ่มลัดชื่อศิลปินอัตโนมัติ
    if (chipContainer) {
        const artists = ['All', ...new Set(window.songs.map(s => s.artist || 'ไม่ระบุศิลปิน'))];
        chipContainer.innerHTML = artists.map(a => 
            `<button class="chip ${artistFilter === a ? 'active' : ''}" onclick="filterByArtist('${a}')">${a === 'All' ? 'ทั้งหมด' : a}</button>`
        ).join('');
    }

    // กรองข้อมูลตามที่ค้นหา + ศิลปินที่เลือก
    const filteredSongs = window.songs.filter(song => {
        const q = query.toLowerCase();
        const artist = song.artist || 'ไม่ระบุศิลปิน';
        const titleMatch = song.title && song.title.toLowerCase().includes(q);
        const artistMatch = artist.toLowerCase().includes(q);
        const artistFilterMatch = (artistFilter === 'All' || artist === artistFilter);
        
        return (titleMatch || artistMatch) && artistFilterMatch;
    });

    if (filteredSongs.length === 0) {
        listContainer.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center; margin-top:40px;">' + (window.songs.length === 0 ? 'ยังไม่มีเพลงในคลัง' : 'ไม่พบเพลงที่ค้นหา') + '</p>';
        return;
    }

    filteredSongs.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-item';
        
        const videoId = window.extractYouTubeID(song.audioPath);
        const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
        
        let actionsHtml = '';
        if (window.isAdmin) {
            actionsHtml = `
                <button class="btn-action btn-secondary" onclick="editSong('${song.id}')">✏️</button>
                <button class="btn-action btn-secondary" style="background:rgba(229, 57, 53, 0.2); border-color:rgba(229, 57, 53, 0.4); color:#ef5350;" onclick="deleteSong('${song.id}')">ลบ</button>
            `;
        }
        
        item.innerHTML = `
            <div class="song-info-wrapper">
                <img src="${thumbUrl}" class="song-thumbnail" onerror="this.style.display='none'" alt="Cover">
                <div class="song-item-title-container">
                    <div class="song-item-title">
                        ${song.title}
                        <span style="font-size: 0.85em; color: #8e8e93; display: block; margin-top: 4px;">🎤 ${song.artist || 'ไม่ระบุศิลปิน'}</span>
                    </div>
                </div>
            </div>
            <div class="song-item-actions">
                <button class="btn-action" style="background: #0a84ff; color: white;" onclick="playSong('${song.id}')">▶ เล่น</button>
                ${actionsHtml}
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// ----------------------------------------------------
// ระบบเล่นเพลง & เนื้อเพลง
// ----------------------------------------------------
window.deleteSong = async function(id) {
    if (!window.isAdmin) return;
    if(confirm('ต้องการลบเพลงนี้ใช่หรือไม่?')) {
        try {
            await deleteDoc(doc(db, "songs", id));
            await fetchSongs();
        } catch(e) {
            console.error(e);
            alert("ลบไม่สำเร็จ");
        }
    }
}

window.playSong = function(id) {
    window.currentSongId = id;
    const song = window.songs.find(s => s.id === id);
    if (!song) return;

    document.getElementById('playerTitle').innerText = song.title;
    document.getElementById('playerArtist').innerText = `ศิลปิน: ${song.artist || 'ไม่ระบุศิลปิน'}`;

    window.currentLyricsArray = song.lyrics.split(/\n\s*\n/);
    window.currentLyricIndex = -1;
    window.renderTimestampEditor();
    window.updateLyricDisplay();
    window.showView('view-player');

    const videoId = window.extractYouTubeID(song.audioPath);
    
    if (window.ytPlayer) {
        if (typeof window.ytPlayer.loadVideoById === 'function') {
            window.ytPlayer.loadVideoById(videoId);
        }
    } else {
        if (window.isYTApiReady || (window.YT && window.YT.Player)) {
            window.ytPlayer = new YT.Player('youtubePlayer', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'playsinline': 1, 'controls': 1 }
            });
        } else {
            alert("สคริปต์ YouTube ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองกดเล่นอีกครั้งครับ");
            window.showView('view-list');
            return;
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
            if (targetTime !== undefined && targetTime !== null && currentTime >= targetTime) {
                window.nextLyric(true); 
            }
        }

        if (window.currentLyricIndex > -1) {
            const currentLyricTime = currentSong.timestamps[window.currentLyricIndex];
            if (currentLyricTime !== undefined && currentLyricTime !== null && currentTime < currentLyricTime) {
                let expectedIndex = -1;
                for (let i = 0; i < currentSong.timestamps.length; i++) {
                    if (currentSong.timestamps[i] !== null && currentTime >= currentSong.timestamps[i]) {
                        expectedIndex = i;
                    }
                }
                if (window.currentLyricIndex !== expectedIndex) {
                    window.currentLyricIndex = expectedIndex;
                    window.updateLyricDisplay();
                }
            }
        }
    }, 100); 
}

window.saveTimestampsToFirebase = async function() {
    if (!window.isAdmin) return;
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (song) {
        try {
            await updateDoc(doc(db, "songs", window.currentSongId), { timestamps: song.timestamps });
        } catch(e) {
            console.error("Failed to save timestamp to Firebase", e);
        }
    }
}

window.renderTimestampEditor = function() {
    const container = document.getElementById('timestampList');
    container.innerHTML = '';
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song) return;

    window.currentLyricsArray.forEach((lyric, index) => {
        const row = document.createElement('div');
        row.className = 'ts-row';
        row.id = `ts-row-${index}`;
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '5px 8px';
        row.style.borderRadius = '6px';
        row.style.marginBottom = '4px';
        row.style.transition = 'background 0.2s ease';

        const textSnippet = lyric.split('\n')[0] || `ท่อนที่ ${index + 1}`;
        const label = document.createElement('span');
        label.className = 'ts-label';
        label.style.fontSize = '0.85em';
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.paddingRight = '10px';
        label.innerText = `${index + 1}. ${textSnippet.substring(0, 22)}${textSnippet.length > 22 ? '...' : ''}`;

        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.1';
        input.min = '0';
        input.className = 'ts-input';
        input.id = `ts-input-${index}`;
        input.style.width = '85px';
        input.style.margin = '0';
        input.style.padding = '4px 6px';
        input.style.fontSize = '0.85em';
        input.style.background = 'rgba(0, 0, 0, 0.4)';
        input.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        input.style.borderRadius = '5px';
        input.style.color = '#fff';
        input.style.textAlign = 'center';
        
        input.value = (song.timestamps && song.timestamps[index] != null) ? song.timestamps[index].toFixed(1) : '';
        
        if (!window.isAdmin) {
            input.readOnly = true;
            input.style.border = 'none';
            input.style.background = 'transparent';
        } else {
            input.onchange = (e) => {
                const val = parseFloat(e.target.value);
                const songIdx = window.songs.findIndex(s => s.id === window.currentSongId);
                if (songIdx !== -1) {
                    if (!window.songs[songIdx].timestamps) window.songs[songIdx].timestamps = [];
                    window.songs[songIdx].timestamps[index] = isNaN(val) ? null : val;
                    window.saveTimestampsToFirebase();
                }
            };
        }

        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    });
}

window.syncTimestampEditorUI = function() {
    const song = window.songs.find(s => s.id === window.currentSongId);
    if (!song) return;

    window.currentLyricsArray.forEach((_, index) => {
        const row = document.getElementById(`ts-row-${index}`);
        const label = row ? row.querySelector('.ts-label') : null;
        const input = document.getElementById(`ts-input-${index}`);

        if (row && label && input) {
            if (index === window.currentLyricIndex) {
                row.style.background = 'rgba(10, 132, 255, 0.25)';
                label.style.color = '#0a84ff';
                label.style.fontWeight = 'bold';
            } else {
                row.style.background = 'transparent';
                label.style.color = '#ffffff';
                label.style.fontWeight = 'normal';
            }

            if (document.activeElement !== input) {
                input.value = (song.timestamps && song.timestamps[index] != null) ? song.timestamps[index].toFixed(1) : '';
            }
        }
    });
}

window.updateLyricDisplay = function() {
    const displayPrev = document.getElementById('lyricPrev');
    const displayMain = document.getElementById('lyricDisplay');
    const displayNext = document.getElementById('lyricNext');

    displayPrev.classList.remove('slide-up-anim');
    displayMain.classList.remove('slide-up-anim');
    displayNext.classList.remove('slide-up-anim');

    void displayMain.offsetWidth;

    if (window.currentLyricIndex === -1) {
        displayMain.innerText = "กดปุ่ม 'ถัดไป' เพื่อเริ่มแสดงเนื้อเพลง\n🎵 [ เริ่มเพลง ]";
    } else if (window.currentLyricIndex >= window.currentLyricsArray.length) {
        displayMain.innerText = "✨ [ จบเพลง ] ✨";
    } else {
        displayMain.innerText = window.currentLyricsArray[window.currentLyricIndex];
    }

    if (window.currentLyricIndex > 0 && window.currentLyricIndex < window.currentLyricsArray.length + 1) {
        displayPrev.innerText = window.currentLyricsArray[window.currentLyricIndex - 1].split('\n')[0] + "...";
    } else {
        displayPrev.innerText = "";
    }

    if (window.currentLyricIndex >= -1 && window.currentLyricIndex < window.currentLyricsArray.length - 1) {
        displayNext.innerText = window.currentLyricsArray[window.currentLyricIndex + 1].split('\n')[0] + "...";
    } else {
        displayNext.innerText = "";
    }

    displayPrev.classList.add('slide-up-anim');
    displayMain.classList.add('slide-up-anim');
    displayNext.classList.add('slide-up-anim');

    window.syncTimestampEditorUI();
}

window.nextLyric = function(isAuto = false) {
    if (window.currentLyricsArray.length === 0) return;
    if (window.currentLyricIndex < window.currentLyricsArray.length) {
        window.currentLyricIndex++;
        window.updateLyricDisplay();

        if (!isAuto && window.isAdmin && window.currentSongId && window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function') {
            const songIndex = window.songs.findIndex(s => s.id === window.currentSongId);
            if (songIndex !== -1) {
                if (!window.songs[songIndex].timestamps) window.songs[songIndex].timestamps = [];
                window.songs[songIndex].timestamps[window.currentLyricIndex] = window.ytPlayer.getCurrentTime();
                window.saveTimestampsToFirebase();
            }
        }
    }
}

window.prevLyric = function() {
    if (window.currentLyricIndex > -1) {
        if (window.isAdmin && window.currentSongId) {
            const songIndex = window.songs.findIndex(s => s.id === window.currentSongId);
            if (songIndex !== -1 && window.songs[songIndex].timestamps) {
                window.songs[songIndex].timestamps[window.currentLyricIndex] = null;
                window.saveTimestampsToFirebase();
            }
        }
        
        window.currentLyricIndex--;
        window.updateLyricDisplay();
    }
}

window.resetSync = function() {
    if (!window.isAdmin) return;
    if(confirm('ต้องการล้างเวลาที่ซิงค์ไว้ของเพลงนี้ทั้งหมดเพื่อเริ่มจับจังหวะใหม่ใช่หรือไม่?')) {
        const songIndex = window.songs.findIndex(s => s.id === window.currentSongId);
        if (songIndex !== -1) {
            window.songs[songIndex].timestamps = [];
            window.saveTimestampsToFirebase();
            window.currentLyricIndex = -1;
            window.renderTimestampEditor();
            window.updateLyricDisplay();
            if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') window.ytPlayer.seekTo(0);
            alert('ล้างเวลาซิงค์เรียบร้อยครับ กด Next เพื่อเริ่มจับจังหวะใหม่ได้เลย');
        }
    }
}
