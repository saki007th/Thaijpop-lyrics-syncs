// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// ทำงานแยกอิสระ ไม่ยุ่งกับฐานข้อมูล
// ==========================================

let pipWindow = null;
let originalContainer = null;
let targetElement = null;

window.togglePiPMode = async function(targetId) {
    // 1. เช็คว่าเบราว์เซอร์/อุปกรณ์นี้รองรับไหม (เช่น Chrome บนคอมรองรับแน่นอน)
    if (!('documentPictureInPicture' in window)) {
        alert('อุปกรณ์หรือเบราว์เซอร์ของคุณยังไม่รองรับระบบหน้าต่างลอยอิสระครับ \n(แนะนำให้ใช้ Google Chrome บนคอมพิวเตอร์)');
        return;
    }

    // 2. ถ้าเปิด PiP ค้างไว้อยู่แล้ว ให้กดเพื่อปิดและดึงเนื้อเพลงกลับมา
    if (pipWindow) {
        pipWindow.close();
        return;
    }

    // 3. หากล่องเนื้อเพลงที่ต้องการจะดึงออกไป
    targetElement = document.getElementById(targetId);
    if (!targetElement) {
        console.error('หาหน้าต่างเนื้อเพลงไม่เจอ');
        return;
    }

    // จำตำแหน่งเดิมไว้ เพื่อตอนปิดจะได้ดึงกลับมาแปะถูกที่
    originalContainer = targetElement.parentNode;

    try {
        // 4. สั่งสร้างหน้าต่างลอย (กำหนดขนาดเริ่มต้น)
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400,
            height: 600
        });

        // 5. ก๊อปปี้สไตล์ (CSS) ทั้งหมดจากหน้าเว็บหลัก ส่งตามไปที่หน้าต่างใหม่
        [...document.styleSheets].forEach((styleSheet) => {
            try {
                const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                const style = document.createElement('style');
                style.textContent = cssRules;
                pipWindow.document.head.appendChild(style);
            } catch (e) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = styleSheet.type;
                link.media = styleSheet.media;
                link.href = styleSheet.href;
                pipWindow.document.head.appendChild(link);
            }
        });

        // 6. แต่งสีพื้นหลังหน้าต่างใหม่ และย้ายเนื้อเพลงเข้าไป
        pipWindow.document.body.style.background = '#0a0a0c'; // สีดำเข้ม
        pipWindow.document.body.style.padding = '20px';
        pipWindow.document.body.style.overflowY = 'auto'; // ให้เลื่อนขึ้นลงได้
        pipWindow.document.body.appendChild(targetElement);

        // 7. ดักจับเหตุการณ์ตอนที่ผู้ใช้ "กดกากบาทปิดหน้าต่างลอย"
        pipWindow.addEventListener('pagehide', (event) => {
            // ย้ายกล่องเนื้อเพลงกลับมาแปะที่เดิมในหน้าเว็บหลัก
            if (originalContainer && targetElement) {
                originalContainer.appendChild(targetElement);
            }
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
