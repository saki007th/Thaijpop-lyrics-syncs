// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// อัปเดต: แก้ไขหน้าปก, รีเซ็ตเนื้อเพลงเมื่อเปลี่ยนเพลง, และเพิ่มแถบ Progress Bar
// ==========================================

let pipWindow = null;
let lastSongId = null; // ตัวแปรสำหรับเช็คว่ามีการเปลี่ยนเพลงหรือไม่

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

        // 1. ใส่สไตล์ CSS (เพิ่มดีไซน์สำหรับแถบความคืบหน้า)
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
            }
            #pip-info {
                display: flex; flex-direction: column; overflow: hidden;
            }
            #pip-title {
                font-size: 16px; font-weight: bold; color: #fff;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            #pip-artist {
                font-size: 13px; color: #8e8e93;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            
            /* 🔴 แถบความคืบหน้า (Progress Bar) */
            #pip-progress-container {
                width: 100%; height: 3px;
                background: rgba(255, 255, 255, 0.1);
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            #pip-progress-bar {
                width: 0%; height: 100%;
                background: #0a84ff; /* สีฟ้าสไตล์ Apple */
                transition: width 0.2s linear; /* ทำให้แถบวิ่งสมูท */
            }

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
                    <div id="pip-title">กำลังโหลด...</div>
                    <div id="pip-artist">🎤 -</div>
                </div>
            </div>
            <!-- กล่องใส่แถบความคืบหน้า -->
            <div id="pip-progress-container">
                <div id="pip-progress-bar"></div>
            </div>
            <div id="pip-lyrics">
                <div id="current-lyric-text">
                    <span style="color:#8e8e93 !important;">🎵 กำลังรอเนื้อเพลง...</span>
                </div>
            </div>
        `;

        // 3. ระบบอัปเดตข้อมูลแบบ Real-time
        pipWindow.syncInterval = setInterval(() => {
            
            // --- ระบบ A: ตรวจจับการเปลี่ยนเพลง ---
            if (window.currentSongId !== lastSongId) {
                lastSongId = window.currentSongId;
                
                // รีเซ็ตเนื้อเพลงทันทีที่เพลงเปลี่ยน (แก้ปัญหาเนื้อเพลงเก่าค้าง)
                pipWindow.document.getElementById('current-lyric-text').innerHTML = '<span style="color:#8e8e93 !important;">🎵 กำลังรอเนื้อเพลง...</span>';
                
                // อัปเดตข้อมูลเพลงและหน้าปก
                if (window.songs) {
                    const song = window.songs.find(s => s.id === window.currentSongId);
                    if (song) {
                        pipWindow.document.getElementById('pip-title').innerText = song.title;
                        pipWindow.document.getElementById('pip-artist').innerText = `🎤 ${song.artist || 'ไม่ระบุศิลปิน'}`;
                        
                        // ค้นหา YouTube ID ที่แท้จริง เพื่อโหลดรูปปก (แก้ปัญหาหน้าปกไม่โหลด)
                        let ytId = song.youtubeId || song.videoId; 
                        if (!ytId && song.url) { // ถ้าเก็บเป็น URL ให้ดึง ID ออกมา
                            const urlMatch = song.url.match(/[?&]v=([^&]+)/) || song.url.match(/youtu\.be\/([^?]+)/);
                            if (urlMatch) ytId = urlMatch[1];
                        }
                        if (!ytId) { // ไม้ตายสุดท้าย: ดึงจาก iframe ที่กำลังเล่นอยู่
                            const iframe = document.querySelector('iframe');
                            if (iframe && iframe.src) {
                                const match = iframe.src.match(/\/embed\/([a-zA-Z0-9_-]+)/);
                                if (match) ytId = match[1];
                            }
                        }
                        
                        const coverImg = pipWindow.document.getElementById('pip-cover');
                        if (ytId) {
                            coverImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                            coverImg.style.display = 'block';
                        }
                    }
                }
            }

            // --- ระบบ B: อัปเดตเนื้อเพลงท่อนปัจจุบัน ---
            const activeLine = document.querySelector('.lyric-line.active');
            if (activeLine) {
                pipWindow.document.getElementById('current-lyric-text').innerHTML = activeLine.innerHTML;
            }

            // --- ระบบ C: อัปเดตแถบความคืบหน้า (Progress Bar) ---
            // ดึงตัวแปร player ของ YouTube (รองรับชื่อตัวแปรทั้ง ytPlayer และ player)
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
            lastSongId = null;
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
