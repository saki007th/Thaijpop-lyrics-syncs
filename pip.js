// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// อัปเดต: แก้ไขหน้าปกและชื่อศิลปินเปลี่ยนตามเพลงและเวอร์ชัน Cover เรียบร้อยแล้ว!
// ==========================================

let pipWindow = null;
let lastTrackKey = null; // 🟢 เปลี่ยนจาก lastSongId เป็น lastTrackKey เพื่อความแม่นยำ

window.togglePiPMode = async function() {
    if (!('documentPictureInPicture' in window)) {
        alert('เบราว์เซอร์ของคุณยังไม่รองรับระบบหน้าต่างลอยอิสระครับ \n(แนะนำ Google Chrome บน PC)');
        return;
    }

    if (pipWindow) {
        pipWindow.close();
        return;
    }

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400,
            height: 480 
        });

        // 1. ใส่สไตล์ CSS
        const style = document.createElement('style');
        style.textContent = `
            body { 
                margin: 0; padding: 0; background: #0a0a0c; color: #fff; 
                display: flex; flex-direction: column; 
                height: 100vh; overflow: hidden; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            }
            #pip-header {
                display: flex; align-items: center; gap: 15px;
                padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.05);
            }
            #pip-cover { width: 60px; height: 60px; border-radius: 12px; object-fit: cover; background: #2c2c2e; display: none; }
            .song-info { flex: 1; overflow: hidden; }
            #pip-title { font-weight: bold; font-size: 1.1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #0a84ff; }
            #pip-artist { font-size: 0.9em; color: #8e8e93; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            
            /* แถบ Progress Bar */
            #pip-progress-container { width: 100%; height: 4px; background: rgba(255,255,255,0.1); }
            #pip-progress-bar { height: 100%; width: 0%; background: #0a84ff; transition: width 0.2s linear; }

            #pip-lyrics-container {
                flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
                padding: 20px; text-align: center;
            }
            .pip-lyric-main { font-size: 1.6em; font-weight: bold; line-height: 1.4; transition: all 0.3s; }
            .pip-lyric-sub { font-size: 1.1em; color: #aaa; margin-top: 8px; transition: all 0.3s; }
            .empty-lyric { color: #555; font-style: italic; }
        `;
        pipWindow.document.head.appendChild(style);

        // 2. สร้างโครงสร้าง HTML หน้าต่าง PiP
        pipWindow.document.body.innerHTML = `
            <div id="pip-header">
                <img id="pip-cover" src="" alt="cover">
                <div class="song-info">
                    <div id="pip-title">กำลังรอเพลง...</div>
                    <div id="pip-artist">-</div>
                </div>
            </div>
            <div id="pip-progress-container">
                <div id="pip-progress-bar"></div>
            </div>
            <div id="pip-lyrics-container">
                <div id="current-lyric-text" class="empty-lyric">🎵 กำลังรอเนื้อเพลง...</div>
            </div>
        `;

        // 3. ตั้งค่าลูปซิงค์ข้อมูล
        pipWindow.syncInterval = setInterval(() => {
            if (!window.currentSongId || !window.songs) return;
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (!song) return;

            // 🟢 ระบบ A: เช็ค Key การเปลี่ยนเพลงที่รวมเวอร์ชัน Cover ไว้ด้วย
            let currentKey = song.id + "_" + (window.currentCoverIndex || -1);

            if (lastTrackKey !== currentKey) {
                lastTrackKey = currentKey;
                
                let targetVideoPath = song.audioPath;
                let displayArtist = song.artist || 'ไม่ระบุศิลปิน';
                
                // สลับชื่อนักร้องและหน้าปกหากเป็นโหมด Cover
                if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
                    targetVideoPath = song.covers[window.currentCoverIndex].audioPath;
                    if(song.covers[window.currentCoverIndex].coverArtist) {
                        displayArtist = song.covers[window.currentCoverIndex].coverArtist;
                    }
                }

                pipWindow.document.getElementById('pip-title').innerText = song.title;
                pipWindow.document.getElementById('pip-artist').innerText = '🎤 ' + displayArtist;
                pipWindow.document.getElementById('current-lyric-text').innerHTML = '<div class="empty-lyric">🎵 กำลังรอเนื้อเพลง...</div>';
                
                const coverImg = pipWindow.document.getElementById('pip-cover');
                if (coverImg) {
                    const ytId = window.extractYouTubeID(targetVideoPath);
                    if (ytId) {
                        coverImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                        coverImg.style.display = 'block';
                    } else {
                        coverImg.style.display = 'none';
                    }
                }
            }

            // --- ระบบ B: อัปเดตเนื้อเพลงท่อนปัจจุบัน ---
            const activeLine = document.querySelector('.lyric-line.active');
            if (activeLine) {
                pipWindow.document.getElementById('current-lyric-text').innerHTML = activeLine.innerHTML;
            }

            // --- ระบบ C: อัปเดตแถบความคืบหน้า (Progress Bar) ---
            const playerObj = window.ytPlayer || window.player; 
            if (playerObj && typeof playerObj.getCurrentTime === 'function') {
                const currentTime = playerObj.getCurrentTime();
                const duration = playerObj.getDuration();
                if (duration > 0) {
                    const percent = (currentTime / duration) * 100;
                    pipWindow.document.getElementById('pip-progress-bar').style.width = `${percent}%`;
                }
            }

        }, 150); 

        // 4. ล้างข้อมูลเมื่อปิดหน้าต่าง
        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipWindow.syncInterval); 
            lastTrackKey = null; // คืนค่าตัวแปร
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
