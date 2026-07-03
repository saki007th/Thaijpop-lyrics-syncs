// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Teleprompter Mode)
// แสดงเฉพาะเนื้อเพลงแบบ Real-time เพื่อหลีกเลี่ยงการถูกบล็อกโดย YouTube
// ==========================================

let pipWindow = null;

window.togglePiPMode = async function() {
    // 1. เช็คว่าเบราว์เซอร์รองรับหรือไม่
    if (!('documentPictureInPicture' in window)) {
        alert('เบราว์เซอร์ของคุณยังไม่รองรับระบบหน้าต่างลอยอิสระครับ \n(แนะนำ Google Chrome บน PC)');
        return;
    }

    // 2. ถ้าเปิดอยู่แล้ว ให้ปิด
    if (pipWindow) {
        pipWindow.close();
        return;
    }

    try {
        // 3. สั่งสร้างหน้าต่างลอย (ปรับขนาดให้เตี้ยลง คล้ายๆ กล่องซับไตเติ้ล)
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 500,
            height: 250
        });

        // 4. ใส่สไตล์ CSS เน้นให้อ่านง่าย ตัวหนังสือเด่นชัด
        const style = document.createElement('style');
        style.textContent = `
            body { 
                margin: 0; 
                background: rgba(10, 10, 12, 0.95); /* สีดำสนิท */
                color: #fff; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                overflow: hidden; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                text-align: center; 
                padding: 20px; 
                box-sizing: border-box;
            }
            #current-lyric-text {
                font-size: 1.4em; 
                font-weight: 700; 
                line-height: 1.5;
                width: 100%;
            }
            /* บังคับให้ข้อความทุกภาษาข้างในเป็นสีสว่างทั้งหมด */
            #current-lyric-text * { 
                color: #ffffff !important; 
                text-shadow: 0 2px 5px rgba(0,0,0,0.8);
                display: block; 
                margin-bottom: 8px;
            }
            /* ตกแต่งชื่อศิลปินให้เล็กและจางลงหน่อย */
            #current-lyric-text .artist-name {
                font-size: 0.6em;
                color: #0a84ff !important;
                margin-bottom: 15px;
            }
        `;
        pipWindow.document.head.appendChild(style);

        // 5. สร้างกล่องใส่เนื้อเพลง
        const lyricText = pipWindow.document.createElement('div');
        lyricText.id = 'current-lyric-text';
        lyricText.innerHTML = '<span style="color:#8e8e93 !important; font-size: 0.8em;">🎵 รอจังหวะเริ่มเพลง...</span>';
        
        pipWindow.document.body.appendChild(lyricText);

        // 6. ดึงเนื้อเพลงท่อนปัจจุบันมาแสดงแบบ Real-time
        pipWindow.syncInterval = setInterval(() => {
            const activeLine = document.querySelector('.lyric-line.active');
            if (activeLine) {
                lyricText.innerHTML = activeLine.innerHTML;
            }
        }, 150); 

        // 7. เหตุการณ์เมื่อผู้ใช้ปิดหน้าต่างลอย
        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipWindow.syncInterval); // หยุดลูปเพื่อประหยัดสเปค
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
