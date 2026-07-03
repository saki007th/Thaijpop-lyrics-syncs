// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// ดีไซน์ใหม่: มีหน้าปก ชื่อเพลง และเนื้อเพลงที่ย่อขยายขนาดได้อัตโนมัติ (ไม่ดึงวิดีโอมา)
// ==========================================

let pipWindow = null;

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
            height: 450 // ปรับให้ทรงหน้าต่างดูสมดุลกับเนื้อเพลง
        });

        // 1. ดึงข้อมูลเพลงปัจจุบันจากระบบหลัก (ที่คุณเก็บไว้ใน window.songs)
        let currentTitle = "กำลังเล่นเพลง...";
        let currentArtist = "ไม่ระบุศิลปิน";
        let coverUrl = "";

        if (window.currentSongId && window.songs) {
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (song) {
                currentTitle = song.title;
                currentArtist = song.artist || "ไม่ระบุศิลปิน";
                // ดึงรูปหน้าปก Thumbnail จาก YouTube โดยตรง
                coverUrl = `https://img.youtube.com/vi/${song.id}/hqdefault.jpg`;
            }
        }

        // 2. ใส่สไตล์ CSS โดยใช้ clamp() และ vmin เพื่อให้ตัวอักษรยืดหยุ่น
        const style = document.createElement('style');
        style.textContent = `
            body { 
                margin: 0; padding: 0; background: #0a0a0c; color: #fff; 
                display: flex; flex-direction: column; 
                height: 100vh; overflow: hidden; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            }
            /* ส่วนหัว: โชว์ปกและชื่อเพลง */
            #pip-header {
                display: flex; align-items: center; gap: 15px;
                padding: 15px 20px;
                background: rgba(255, 255, 255, 0.05);
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            #pip-cover {
                width: 50px; height: 50px;
                border-radius: 8px; object-fit: cover;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                background: #1c1c1e; /* สีพื้นหลังเผื่อรูปยังไม่โหลด */
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
            
            /* ส่วนเนื้อเพลง: จัดกึ่งกลาง และปรับขนาดอักษรอัตโนมัติ */
            #pip-lyrics {
                flex-grow: 1; /* ใช้พื้นที่ที่เหลือทั้งหมด */
                display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                padding: 4vmin; text-align: center; box-sizing: border-box;
                background: radial-gradient(circle at center, #1c1c1e 0%, #0a0a0c 100%);
            }
            #current-lyric-text {
                /* 🌟 ปรับขนาดอัตโนมัติตามหน้าต่าง (เล็กสุด 16px, ยืดหยุ่น 6vmin, ใหญ่สุด 60px) */
                font-size: clamp(16px, 6vmin, 60px); 
                font-weight: 800; line-height: 1.4; width: 100%;
                transition: font-size 0.2s ease;
            }
            #current-lyric-text * { 
                color: #ffffff !important; 
                text-shadow: 0 2px 8px rgba(0,0,0,0.8);
                display: block; margin-bottom: 2vmin; 
            }
            /* บรรทัดรอง (โรมาจิ/คำแปล) ให้ตัวเล็กลงและสีดรอปลง */
            #current-lyric-text span:not(:first-child) {
                font-size: 0.7em;
                color: #a0a0a5 !important;
                font-weight: 600;
            }
        `;
        pipWindow.document.head.appendChild(style);

        // 3. สร้างโครงสร้างหน้าต่าง (HTML)
        const header = pipWindow.document.createElement('div');
        header.id = 'pip-header';
        
        // ใส่รูปปก (ถ้ามี)
        if (coverUrl) {
            const cover = pipWindow.document.createElement('img');
            cover.id = 'pip-cover';
            cover.src = coverUrl;
            header.appendChild(cover);
        }

        // ใส่ชื่อเพลงและศิลปิน
        const info = pipWindow.document.createElement('div');
        info.id = 'pip-info';
        info.innerHTML = `
            <div id="pip-title">${currentTitle}</div>
            <div id="pip-artist">🎤 ${currentArtist}</div>
        `;
        header.appendChild(info);

        // ใส่กล่องเนื้อเพลง
        const lyricsContainer = pipWindow.document.createElement('div');
        lyricsContainer.id = 'pip-lyrics';
        
        const lyricText = pipWindow.document.createElement('div');
        lyricText.id = 'current-lyric-text';
        lyricText.innerHTML = '<span style="color:#8e8e93 !important;">🎵 กำลังรอเนื้อเพลง...</span>';
        
        lyricsContainer.appendChild(lyricText);

        // ประกอบร่าง
        pipWindow.document.body.appendChild(header);
        pipWindow.document.body.appendChild(lyricsContainer);

        // 4. สั่งให้คอยอัปเดตเนื้อเพลงเรื่อยๆ แบบ Real-time
        pipWindow.syncInterval = setInterval(() => {
            // อัปเดตเนื้อเพลง
            const activeLine = document.querySelector('.lyric-line.active');
            if (activeLine) {
                lyricText.innerHTML = activeLine.innerHTML;
            }

            // (แถม) ตรวจสอบว่าถ้าผู้ใช้กดเปลี่ยนเพลงในหน้าหลัก ให้รูปปกและชื่อใน PiP เปลี่ยนตามด้วย
            if (window.currentSongId && window.songs) {
                const s = window.songs.find(x => x.id === window.currentSongId);
                if (s) {
                    pipWindow.document.getElementById('pip-title').innerText = s.title;
                    pipWindow.document.getElementById('pip-artist').innerText = `🎤 ${s.artist || 'ไม่ระบุศิลปิน'}`;
                    const img = pipWindow.document.getElementById('pip-cover');
                    if (img && img.src !== `https://img.youtube.com/vi/${s.id}/hqdefault.jpg`) {
                        img.src = `https://img.youtube.com/vi/${s.id}/hqdefault.jpg`;
                    }
                }
            }
        }, 150); 

        // 5. เมื่อผู้ใช้ปิดหน้าต่าง PiP ให้เคลียร์ระบบความจำ
        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipWindow.syncInterval); 
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
