// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงและวิดีโอลอยอิสระ (Document Picture-in-Picture)
// ดีไซน์ใหม่: วิดีโออยู่ด้านบน เนื้อเพลง ด้านล่าง + ขนาดตัวอักษรยืดหยุ่นอัตโนมัติ
// ==========================================

let pipWindow = null;
let originalPlayerParent = null;
let playerElement = null;

window.togglePiPMode = async function() {
    if (!('documentPictureInPicture' in window)) {
        alert('เบราว์เซอร์ของคุณยังไม่รองรับระบบหน้าต่างลอยอิสระครับ \n(แนะนำ Google Chrome บน PC)');
        return;
    }

    if (pipWindow) {
        pipWindow.close();
        return;
    }

    const iframe = document.querySelector('iframe');
    if (!iframe) {
        alert('ไม่พบวิดีโอที่กำลังเล่นอยู่ครับ');
        return;
    }
    playerElement = iframe.parentNode; 
    originalPlayerParent = playerElement.parentNode; 

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 450,
            height: 600
        });

        // 🔴 ปรับปรุง CSS ใหม่ เพื่อให้ขนาดตัวอักษรและระยะห่าง ยืดหยุ่นตามขนาดหน้าจอ (Responsive)
        const style = document.createElement('style');
        style.textContent = `
            body { 
                margin: 0; background: #000; color: #fff; 
                display: flex; flex-direction: column; 
                height: 100vh; overflow: hidden; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            }
            #pip-video-container { 
                width: 100%; height: 50%; 
                background: #0a0a0c; 
                display: flex; justify-content: center; align-items: center; 
            }
            #pip-video-container iframe { 
                width: 100%; height: 100%; border: none; 
            }
            #pip-lyric-container { 
                width: 100%; height: 50%; 
                background: linear-gradient(180deg, #1c1c1e 0%, #0a0a0c 100%);
                /* ใช้หน่วย vmin เพื่อให้ Padding ยืดหยุ่นตามหน้าจอ */
                padding: 4vmin; box-sizing: border-box;
                display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                text-align: center; border-top: 1px solid rgba(255,255,255,0.1);
                overflow: hidden; /* ป้องกันเนื้อหาล้นทะลุกรอบ */
            }
            #current-lyric-text {
                /* 🌟 พระเอกของงานนี้: clamp(เล็กสุด, ค่าที่ให้ยืดหยุ่น, ใหญ่สุด) */
                font-size: clamp(14px, 4.5vmin, 42px); 
                font-weight: 700; line-height: 1.5;
                transition: font-size 0.2s ease, transform 0.3s ease;
                width: 100%;
            }
            #current-lyric-text * { 
                color: #ffffff !important; 
                text-shadow: 0 2px 5px rgba(0,0,0,0.8);
                display: block; 
                /* ระยะห่างระหว่างบรรทัดยืดหยุ่นตามหน้าจอ */
                margin-bottom: 1.5vmin; 
            }
            /* ลดขนาดตัวอักษรบรรทัดล่างสุด (สมมติว่าเป็นคำแปลไทย/โรมาจิ) ลงเล็กน้อย เพื่อลำดับสายตาที่ดีขึ้น */
            #current-lyric-text span:not(:first-child) {
                font-size: 0.85em;
                color: #d1d1d6 !important; /* ให้สีดรอปลงนิดหน่อยจะได้อ่านง่าย */
            }
        `;
        pipWindow.document.head.appendChild(style);

        const videoContainer = pipWindow.document.createElement('div');
        videoContainer.id = 'pip-video-container';
        videoContainer.appendChild(playerElement); 

        const lyricContainer = pipWindow.document.createElement('div');
        lyricContainer.id = 'pip-lyric-container';
        
        const lyricText = pipWindow.document.createElement('div');
        lyricText.id = 'current-lyric-text';
        lyricText.innerHTML = '<span style="color:#8e8e93 !important;">🎵 กำลังรอเนื้อเพลง...</span>';
        
        lyricContainer.appendChild(lyricText);

        pipWindow.document.body.appendChild(videoContainer);
        pipWindow.document.body.appendChild(lyricContainer);

        pipWindow.syncInterval = setInterval(() => {
            const activeLine = document.querySelector('.lyric-line.active');
            if (activeLine) {
                lyricText.innerHTML = activeLine.innerHTML;
            }
        }, 150); 

        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipWindow.syncInterval); 
            if (originalPlayerParent && playerElement) {
                originalPlayerParent.appendChild(playerElement);
            }
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
