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

// ปิด Dropdown ครอบคลุม
document.addEventListener('click', function(e) {
    if (!e.target.closest('.ts-singer-dropdown')) {
        document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    }
});
window.addEventListener('scroll', function(e) {
    if (e.target.id === 'timestampList' || e.target.id === 'lyricsContainer') {
        document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
    }
}, true);

// สกัดชื่อศิลปิน
window.getSingersList = function(artistStr) {
    if (!artistStr) return [];
    let parts = [];
    if (artistStr.includes('[')) {
        const matches = artistStr.match(/\[(.*?)\]/g);
        if (matches) parts = matches.map(m => m.replace(/[\[\]]/g, ''));
        else parts = [artistStr];
    } else {
        parts = artistStr.split(/[,/&]+/);
    }
    return parts.map(p => p.trim()).filter(p => p);
};

// ระบบเปลี่ยนสีธีม และ พื้นหลัง
const themes = {
    'default': 'linear-gradient(120deg, #00d2ff, #9b51e0, #ff2a85, #ff8c00, #00d2ff)',
    'ocean': 'linear-gradient(120deg, #2193b0, #6dd5ed, #2193b0, #6dd5ed)',
    'sunset': 'linear-gradient(120deg, #ff4e50, #f9d423, #ff4e50, #f9d423)',
    'neon': 'linear-gradient(120deg, #ff0099, #493240, #ff0099, #493240)',
    'emerald': 'linear-gradient(120deg, #11998e, #38ef7d, #11998e, #38ef7d)'
};
window.setTheme = function(themeName) {
    const glowColor = themes[themeName] || themes['default'];
    document.documentElement.style.setProperty('--theme-glow', glowColor);
    localStorage.setItem('selectedTheme', themeName);
}

const backgrounds = {
    'black': '#000000', 'darkgray': '#1c1c1e', 'midnight': '#0a0f24', 'deeppurple': '#1a0b2e'
};
window.setBackground = function(bgName) {
    const bgColor = backgrounds[bgName] || backgrounds['black'];
    document.documentElement.style.setProperty('--bg-color', bgColor);
    localStorage.setItem('selectedBg', bgName);
}
const savedTheme = localStorage.getItem('selectedTheme') || 'default';
window.setTheme(savedTheme);
const savedBg = localStorage.getItem('selectedBg') || 'black';
window.setBackground(savedBg);

window.onYouTubeIframeAPIReady = function() { window.isYTApiReady = true; };

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
    try { await signInWithPopup(auth, provider); } 
    catch (error) { console.error(error); alert("เข้าสู่ระบบไม่สำเร็จ"); }
}

window.logout = async function() {
    if(confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
        try {
            await signOut(auth);
            if (window.ytPlayer && typeof window.ytPlayer.stopVideo === 'function') window.ytPlayer.stopVideo();
        } catch (error) { console.error(error); }
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
                timestamps: data.timestamps || [],
                singers: data.singers || [] 
            });
        });
        document.getElementById('loadingOverlay').style.display = 'none';
        
        if (!document.getElementById('view-player').classList.contains('active') && 
            !document.getElementById('view-add').classList.contains('active') &&
            !document.getElementById('view-settings').classList.contains('active')) {
            window.showView('view-list');
        } else {
            window.renderSongList();
        }
    } catch (error) {
        console.error(error); alert("เชื่อมต่อฐานข้อมูลไม่สำเร็จ");
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
        window.currentFilter = 'All'; 
        window.renderSongList();
        clearInterval(window.syncInterval);
        window.currentSongId = null;
        if (window.ytPlayer && typeof window.ytPlayer.stopVideo === 'function') window.ytPlayer.stopVideo();
    } else if (viewId === 'view-player') {
        headerTitle.innerText = 'กำลังเล่นเพลง';
        document.getElementById('btnAddSong').style.display = 'none';
        
        const playerContainer = document.getElementById('view-player');
        const lyricControlBtnGroup = document.getElementById('lyricControlBtnGroup');
        const timestampEditorSection = document.getElementById('timestampEditorSection');
        const btnResetSync = document.getElementById('btnResetSync');

        if (window.isAdmin) {
            if (playerContainer) playerContainer.classList.remove('user-mode');
            if(lyricControlBtnGroup) lyricControlBtnGroup.style.display = 'flex';
            if(timestampEditorSection) timestampEditorSection.style.display = 'block';
            if(btnResetSync) btnResetSync.style.display = 'block';
        } else {
            if (playerContainer) playerContainer.classList.add('user-mode');
            if(lyricControlBtnGroup) lyricControlBtnGroup.style.display = 'none';
            if(timestampEditorSection) timestampEditorSection.style.display = 'none';
            if(btnResetSync) btnResetSync.style.display = 'none';
        }
    } else if (viewId === 'view-settings') {
        headerTitle.innerText = 'การตั้งค่า';
        document.getElementById('btnAddSong').style.display = 'none';
    } else {
        document.getElementById('btnAddSong').style.display = 'none';
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
    if (!window.isAdmin) return;
    
    const title = document.getElementById('inputTitle').value.trim();
    const artist = document.getElementById('inputArtist').value.trim();
    const audioPath = document.getElementById('inputAudio').value.trim();
    const lyrics = document.getElementById('inputLyrics').value.trim();
    const btnSave = document.getElementById('btnSave');

    if (!title || !lyrics || !window.extractYouTubeID(audioPath)) {
        alert("ข้อมูลไม่ครบถ้วน หรือลิงก์ YouTube ไม่ถูกต้อง"); return;
    }

    btnSave.disabled = true;
    btnSave.innerText = "กำลังบันทึก...";

    try {
        if (window.editingSongId) {
            const songRef = doc(db, "songs", window.editingSongId);
            await updateDoc(songRef, { title, artist, audioPath, lyrics });
        } else {
            await addDoc(songsCollection, { title, artist, audioPath, lyrics, timestamps: [], singers: [] });
        }
        await fetchSongs();
        window.showView('view-list'); 
    } catch (e) {
        console.error(e); alert("บันทึกไม่สำเร็จ");
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = "💾 บันทึกเพลง";
        window.editingSongId = null;
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

window.renderSongList = function(query = '', artistFilter = 'All') {
    const listContainer = document.getElementById('songList');
    const chipContainer = document.getElementById('artistChips');
    listContainer.innerHTML = '';

    if (chipContainer) {
        let artistSet = new Set();
        window.songs.forEach(s => {
            window.getSingersList(s.artist).forEach(cleanName => artistSet.add(cleanName));
        });

        const artists = ['All', ...Array.from(artistSet)];
        chipContainer.innerHTML = artists.map(a => 
            `<button class="chip ${artistFilter === a ? 'active' : ''}" onclick="filterByArtist('${a}')">${a === 'All' ? 'ทั้งหมด' : a}</button>`
        ).join('');
    }

    const filteredSongs = window.songs.filter(song => {
        const q = query.toLowerCase();
        const artist = song.artist || 'ไม่ระบุศิลปิน';
        const searchMatch = (song.title && song.title.toLowerCase().includes(q)) || artist.toLowerCase().includes(q);
        const filterMatch = (artistFilter === 'All' || artist.includes(artistFilter));
        return searchMatch && filterMatch;
    });

    if (filteredSongs.length === 0) {
        listContainer.innerHTML = '<p style="color:rgba(255,255,255,0.5); text-align:center; margin-top:40px;">ไม่พบเพลงที่ค้นหา</p>';
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

window.deleteSong = async function(id) {
    if (!window.isAdmin) return;
    if(confirm('ต้องการลบเพลงนี้ใช่หรือไม่?')) {
        try { await deleteDoc(doc(db, "songs", id)); await fetchSongs(); } 
        catch(e) { console.error(e); }
    }
}

window.renderLyricsToContainer = function() {
    const container = document.getElementById('lyricsContainer');
    if(!container) return;
    container.innerHTML = ''; 
    
    if (window.currentLyricsArray.length === 0) {
        container.innerHTML = '<div class="lyric-line align-center">ไม่มีเนื้อเพลง</div>';
        return;
    }

    const currentSong = window.songs.find(s => s.id === window.currentSongId);

    // ดึงรายชื่อนักร้องเดี่ยว (คนที่ร้องคนเดียวในท่อน) เพื่อเอาไว้สลับซ้าย-ขวา
    let uniqueSingers = [];
    if (currentSong && currentSong.singers) {
        currentSong.singers.forEach(s => {
            if(s) {
                const arr = s.split(',').map(x=>x.trim()).filter(x=>x);
                if(arr.length === 1 && !uniqueSingers.includes(arr[0])) {
                    uniqueSingers.push(arr[0]);
                }
            }
        });
    }

    window.currentLyricsArray.forEach((lyric, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'lyric-line';
        lineDiv.id = `lyric-line-${index}`;

        let htmlContent = lyric;
        let alignClass = 'align-center'; // ค่าเริ่มต้น: ตรงกลางเสมอ

        const singerString = (currentSong && currentSong.singers && currentSong.singers[index]) ? currentSong.singers[index] : null;

        if (singerString) {
            const singersArr = singerString.split(',').map(s => s.trim()).filter(s => s);
            if (singersArr.length > 0) {
                const badgesHtml = singersArr.map(s => `<span class="singer-badge">${s}</span>`).join('');
                
                // ตรวจสอบว่าร้องกี่คน เพื่อจัด ซ้าย ขวา หรือ กลาง
                if (singersArr.length === 1) {
                    const singerIdx = uniqueSingers.indexOf(singersArr[0]);
                    // สลับ ซ้าย-ขวา (เลขคู่ไปซ้าย เลขคี่ไปขวา)
                    if (singerIdx % 2 === 0) {
                        alignClass = 'align-left';
                    } else {
                        alignClass = 'align-right';
                    }
                } else {
                    // ถ้าร้องพร้อมกันหลายคน ให้อยู่ตรงกลาง
                    alignClass = 'align-center';
                }

                htmlContent = `<div class="singer-badges">${badgesHtml}</div><div>${lyric}</div>`;
            } else {
                htmlContent = `<div>${lyric}</div>`;
            }
        } else {
            htmlContent = `<div>${lyric}</div>`;
        }

        lineDiv.classList.add(alignClass); // ใส่คลาสจัดตำแหน่ง
        lineDiv.innerHTML = htmlContent;
        container.appendChild(lineDiv);
    });
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
    window.renderLyricsToContainer(); 
    window.updateLyricDisplay();
    window.showView('view-player');

    const videoId = window.extractYouTubeID(song.audioPath);
    
    if (window.ytPlayer) {
        if (typeof window.ytPlayer.loadVideoById === 'function') window.ytPlayer.loadVideoById(videoId);
    } else {
        if (window.isYTApiReady || (window.YT && window.YT.Player)) {
            window.ytPlayer = new YT.Player('youtubePlayer', {
                height: '100%', width: '100%', videoId: videoId,
                playerVars: { 'playsinline': 1, 'controls': 1 }
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
            const lyricCount = window.currentLyricsArray.length;
            const safeTimestamps = Array.from({length: lyricCount}, (_, i) => 
                (song.timestamps && song.timestamps[i] != null) ? song.timestamps[i] : null
            );
            const safeSingers = Array.from({length: lyricCount}, (_, i) => 
                (song.singers && song.singers[i] != null) ? song.singers[i] : ""
            );

            await updateDoc(doc(db, "songs", window.currentSongId), { 
                timestamps: safeTimestamps,
                singers: safeSingers
            });
            song.timestamps = safeTimestamps;
            song.singers = safeSingers;
            
        } catch(e) {
            console.error("Firebase Update Error:", e);
        }
    }
}

// ----------------------------------------------------
// ระบบ Sync 
// ----------------------------------------------------
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

        const textSnippet = lyric.split('\n')[0] || `ท่อนที่ ${index + 1}`;
        const label = document.createElement('span');
        label.className = 'ts-label';
        label.style.fontSize = '0.85em';
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.paddingRight = '10px';
        label.style.flexGrow = '1';
        label.innerText = `${index + 1}. ${textSnippet.substring(0, 22)}${textSnippet.length > 22 ? '...' : ''}`;

        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '6px';
        controlsDiv.style.flexShrink = '0';
        controlsDiv.style.alignItems = 'center';

        if (window.isAdmin) {
            const allSingers = window.getSingersList(song.artist);
            const dropdown = document.createElement('div');
            dropdown.className = 'ts-singer-dropdown';
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'ts-dropdown-toggle';
            
            const currentSingers = (song.singers && song.singers[index]) ? song.singers[index].split(',').map(s=>s.trim()).filter(s=>s) : [];
            toggleBtn.innerText = currentSingers.length > 0 ? currentSingers.join(', ') : '👤 เลือกร้อง';
            
            const menu = document.createElement('div');
            menu.className = 'ts-dropdown-menu';
            
            allSingers.forEach(singer => {
                const itemLabel = document.createElement('label');
                itemLabel.className = 'ts-dropdown-item';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = singer;
                checkbox.checked = currentSingers.includes(singer);
                
                checkbox.onchange = () => {
                    const selected = Array.from(menu.querySelectorAll('input:checked')).map(cb => cb.value);
                    toggleBtn.innerText = selected.length > 0 ? selected.join(', ') : '👤 เลือกร้อง';
                    
                    const songIdx = window.songs.findIndex(s => s.id === window.currentSongId);
                    if (songIdx !== -1) {
                        if (!window.songs[songIdx].singers) window.songs[songIdx].singers = [];
                        window.songs[songIdx].singers[index] = selected.length > 0 ? selected.join(', ') : "";
                        window.saveTimestampsToFirebase();
                        window.renderLyricsToContainer();
                        window.updateLyricDisplay();
                    }
                };
                
                itemLabel.appendChild(checkbox);
                itemLabel.appendChild(document.createTextNode(' ' + singer));
                menu.appendChild(itemLabel);
            });
            
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                const isShowing = menu.classList.contains('show');
                document.querySelectorAll('.ts-dropdown-menu.show').forEach(m => m.classList.remove('show'));
                
                if (!isShowing) {
                    menu.classList.add('show');
                    const rect = toggleBtn.getBoundingClientRect();
                    menu.style.position = 'fixed'; 
                    menu.style.left = rect.left + 'px';
                    menu.style.top = (rect.bottom + 5) + 'px'; 
                    
                    setTimeout(() => {
                        const menuRect = menu.getBoundingClientRect();
                        if (menuRect.bottom > window.innerHeight) {
                            menu.style.top = (rect.top - menuRect.height - 5) + 'px';
                        }
                    }, 0);
                }
            };
            
            dropdown.appendChild(toggleBtn);
            dropdown.appendChild(menu);
            controlsDiv.appendChild(dropdown);
        }

        const timeInput = document.createElement('input');
        timeInput.type = 'number'; timeInput.step = '0.1'; timeInput.min = '0';
        timeInput.className = 'ts-input'; timeInput.id = `ts-input-${index}`;
        timeInput.style.width = '70px'; timeInput.style.margin = '0'; timeInput.style.padding = '4px 6px';
        timeInput.style.fontSize = '0.85em'; timeInput.style.background = 'rgba(0, 0, 0, 0.4)';
        timeInput.style.border = '1px solid rgba(255, 255, 255, 0.2)'; timeInput.style.borderRadius = '5px';
        timeInput.style.color = '#fff'; timeInput.style.textAlign = 'center';
        
        timeInput.value = (song.timestamps && song.timestamps[index] != null) ? song.timestamps[index].toFixed(1) : '';
        
        if (!window.isAdmin) {
            timeInput.readOnly = true; timeInput.style.border = 'none'; timeInput.style.background = 'transparent';
        } else {
            timeInput.onchange = (e) => {
                const val = parseFloat(e.target.value);
                const songIdx = window.songs.findIndex(s => s.id === window.currentSongId);
                if (songIdx !== -1) {
                    if (!window.songs[songIdx].timestamps) window.songs[songIdx].timestamps = [];
                    window.songs[songIdx].timestamps[index] = isNaN(val) ? null : val;
                    window.saveTimestampsToFirebase();
                }
            };
        }
        
        controlsDiv.appendChild(timeInput);
        row.appendChild(label);
        row.appendChild(controlsDiv);
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
    const container = document.getElementById('lyricsContainer');
    if (!container) return;

    const allLines = container.querySelectorAll('.lyric-line');
    allLines.forEach(line => line.classList.remove('active'));

    if (window.currentLyricIndex >= 0 && window.currentLyricIndex < window.currentLyricsArray.length) {
        const activeLine = document.getElementById(`lyric-line-${window.currentLyricIndex}`);
        
        if (activeLine) {
            activeLine.classList.add('active'); 
            
            const containerCenter = container.clientHeight / 2;
            const lineCenter = activeLine.offsetTop + (activeLine.clientHeight / 2);
            
            container.scrollTo({ top: lineCenter - containerCenter, behavior: 'smooth' });
        }
    } else if (window.currentLyricIndex === -1) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
    }

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
            window.songs[songIndex].singers = []; 
            window.saveTimestampsToFirebase();
            window.currentLyricIndex = -1;
            window.renderTimestampEditor();
            window.updateLyricDisplay();
            if (window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') window.ytPlayer.seekTo(0);
            alert('ล้างเวลาซิงค์เรียบร้อยครับ');
        }
    }
}
// ==========================================
// 📱 ระบบสลับมุมมอง (Desktop Split / Mobile Stacked)
// ==========================================
window.toggleViewMode = function() {
    const player = document.getElementById('view-player');
    if (player) {
        player.classList.toggle('stacked-mode');
        
        // เลื่อนหน้าจอขึ้นไปด้านบนสุดเพื่อให้เห็นวิดีโอทันทีที่สลับโหมด
        if (player.classList.contains('stacked-mode')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}
