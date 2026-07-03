// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงและวิดีโอลอยอิสระ (Document Picture-in-Picture)
// ดีไซน์ใหม่: วิดีโออยู่ด้านบน เนื้อเพลงท่อนปัจจุบันอยู่ด้านล่าง
// ==========================================

let pipWindow = null;
let originalPlayerParent = null;
let playerElement = null;

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

    // 3. ค้นหากล่องที่ครอบวิดีโอ YouTube ไว้ (หาจาก iframe โดยตรงเพื่อความชัวร์)
    const iframe = document.querySelector('iframe');
    if (!iframe) {
        alert('ไม่พบวิดีโอที่กำลังเล่นอยู่ครับ');
        return;
    }
    playerElement = iframe.parentNode; 
    originalPlayerParent = playerElement.parentNode; // จำที่อยู่เดิมไว้

    try {
        // 4. สั่งสร้างหน้าต่างลอย
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 450,
            height: 600
        });

        // 5. ใส่สไตล์ CSS เฉพาะสำหรับหน้าต่าง PiP โดยบังคับให้ตัวหนังสือสว่างและอ่านง่าย
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
                padding: 20px; box-sizing: border-box;
                display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                text-align: center; border-top: 1px solid rgba(255,255,255,0.1);
            }
            #current-lyric-text {
                font-size: 1.3em; font-weight: 700; line-height: 1.6;
                transition: all 0.3s ease;
            }
            /* บังคับให้ข้อความทุกภาษาข้างในเป็นสีสว่างทั้งหมด */
            #current-lyric-text * { 
                color: #ffffff !important; 
                text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                display: block; margin-bottom: 8px;
            }
        `;
        pipWindow.document.head.appendChild(style);

        // 6. สร้างกล่องสำหรับใส่วิดีโอ และกล่องใส่เนื้อเพลง
        const videoContainer = pipWindow.document.createElement('div');
        videoContainer.id = 'pip-video-container';
        videoContainer.appendChild(playerElement); // ย้ายวิดีโอมาใส่

        const lyricContainer = pipWindow.document.createElement('div');
        lyricContainer.id = 'pip-lyric-container';
        
        const lyricText = pipWindow.document.createElement('div');
        lyricText.id = 'current-lyric-text';
        lyricText.innerHTML = '<span style="color:#8e8e93 !important;">🎵 กำลังรอเนื้อเพลง...</span>';
        
        lyricContainer.appendChild(lyricText);

        // ประกอบเข้าหน้าต่าง PiP
        pipWindow.document.body.appendChild(videoContainer);
        pipWindow.document.body.appendChild(lyricContainer);

        // 7. ใช้ setInterval เพื่อดึงเนื้อเพลง "ท่อนปัจจุบัน (Active)" มาแสดงผลแบบ Real-time
        pipWindow.syncInterval = setInterval(() => {
            // ดึงท่อนที่มีคลาส .active จากหน้าเว็บหลัก
            const activeLine = document.querySelector('.lyric-line.active');
            if (activeLine) {
                // คัดลอกข้อความมาแสดง (ดึงมาครบทุกภาษา)
                lyricText.innerHTML = activeLine.innerHTML;
            }
        }, 150); // เช็คและอัปเดตทุกๆ 0.15 วินาที

        // 8. เหตุการณ์เมื่อผู้ใช้ปิดหน้าต่างลอย
        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipWindow.syncInterval); // หยุดลูปอัปเดต
            // ย้ายวิดีโอกลับหน้าเว็บหลัก
            if (originalPlayerParent && playerElement) {
                originalPlayerParent.appendChild(playerElement);
            }
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
