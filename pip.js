// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// อัปเดต: คืนชีพหน้าตาเนื้อเพลงสุดสวย + ระบบหน้าปกฉลาด (รองรับเพลง Cover)
// ==========================================

let pipWindow = null;
let lastTrackKey = null; // ตัวแปรสำหรับเช็คว่ามีการเปลี่ยนเพลงหรือสลับเวอร์ชัน Cover หรือไม่

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

        // 1. ใส่สไตล์ CSS (ผสานความสวยงามเดิม + โครงสร้างใหม่)
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
                padding: 15px 20px;
                background: rgba(255, 255, 255, 0.05);
            }
            #pip-cover {
                width: 50px; height: 50px;
                border-radius: 8px; object-fit: cover;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                background: #1c1c1e; 
                display: none; /* ซ่อนไว้ก่อนถ้ายังไม่มีรูป */
            }
            #pip-info {
                display: flex; flex-direction: column; overflow: hidden; flex: 1;
            }
            #pip-title {
                font-size: 16px; font-weight: bold; color: #0a84ff;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            #pip-artist {
                font-size: 13px; color: #8e8e93; margin-top: 2px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            
            /* แถบความคืบหน้า (Progress Bar) */
            #pip-progress-container {
                width: 100%; height: 3px;
                background: rgba(255, 255, 255, 0.1);
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            #pip-progress-bar {
                width: 0%; height: 100%;
                background: #0a84ff; 
                transition: width 0.2s linear; 
            }

            /* 🟢 คืนชีพ CSS เนื้อเพลงสุดสวยของคุณ! */
            #pip-lyrics {
                flex-grow: 1; 
                display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                padding: 4vmin; text-align: center; box-sizing: border-box;
                background: radial-gradient(circle at center, #1c1c1e 0%, #0a0a0c 100%);
            }
            #current-lyric-text {
                font-size: clamp(16px, 6vmin, 60px); 
                font-weight: 800; line-height: 1.4; width: 100%;
                transition: font-size 0.2s ease;
            }
            #current-lyric-text * { 
                color: #ffffff !important; 
                text-shadow: 0 2px 8px rgba(0,0,0,0.8);
                display: block; margin-bottom: 2vmin; 
            }
            #current-lyric-text span:not(:first-child) {
                font-size: 0.7em; color: #a0a0a5 !important; font-weight: 600;
            }
        `;
        pipWindow.document.head.appendChild(style);

        // 2. สร้างโครงสร้างหน้าต่าง (HTML)
        pipWindow.document.body.innerHTML = `
            <div id="pip-header">
                <img id="pip-cover" src="" alt="cover" onerror="this.style.display='none'">
                <div id="pip-info">
                    <div id="pip-title">กำลังรอเพลง...</div>
                    <div id="pip-artist">🎤 -</div>
                </div>
            </div>
            <div id="pip-progress-container">
                <div id="pip-progress-bar"></div>
            </div>
            <div id="pip-lyrics">
                <div id="current-lyric-text">
                    <span style="color:#8e8e93 !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>
                </div>
            </div>
        `;

        // 3. ระบบอัปเดตข้อมูลแบบ Real-time
        pipWindow.syncInterval = setInterval(() => {
            if (!window.currentSongId || !window.songs) return;
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (!song) return;
            
            // 🟢 ระบบ A: ตรวจจับการเปลี่ยนเพลง และ เวอร์ชัน Cover
            let currentKey = song.id + "_" + (window.currentCoverIndex || -1);

            if (lastTrackKey !== currentKey) {
                lastTrackKey = currentKey;
                
                // รีเซ็ตข้อความระหว่างเปลี่ยนเพลง
                pipWindow.document.getElementById('current-lyric-text').innerHTML = '<span style="color:#8e8e93 !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>';
                
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
                pipWindow.document.getElementById('pip-artist').innerText = `🎤 ${displayArtist}`;
                
                const coverImg = pipWindow.document.getElementById('pip-cover');
                const ytId = window.extractYouTubeID(targetVideoPath);
                if (ytId) {
                    coverImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                    coverImg.style.display = 'block';
                } else {
                    coverImg.style.display = 'none';
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
            lastTrackKey = null;
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
