import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// 1. ฟังก์ชันโหลดสีตอนเปิดเว็บ
// ==========================================
export async function initializeSingerColors(db) {
    window.SINGER_COLORS = {}; 
    const colorDocRef = doc(db, 'settings', 'singerColors');

    try {
        const docSnap = await getDoc(colorDocRef);
        if (docSnap.exists()) {
            window.SINGER_COLORS = docSnap.data();
            console.log("🎨 โหลดสีนักร้องสำเร็จ!");
        } else {
            console.log("🛠️ ไม่พบฐานข้อมูลสี... กำลังสร้างแฟ้มใหม่อัตโนมัติ");
            const defaultColors = {
                "Tokoyami Towa": "#FF69B4",
                "Yozora Mel": "#FFD700",
                "Hoshimachi Suisei": "#87CEEB",
                "Minato Aqua": "#FFB6C1",
                "Nekomata Okayu": "#9370DB"
            };
            await setDoc(colorDocRef, defaultColors);
            window.SINGER_COLORS = defaultColors;
        }
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการโหลดสี:", error);
    }
}

// ==========================================
// 2. ฟังก์ชันเปิดหน้าต่างแอดมิน (เวอร์ชันล่าสุด มีปุ่มเพิ่มเอง)
// ==========================================
export async function openSingerColorManager(db) {
    const allSingers = new Set();
    
    // 1. ดึงชื่อนักร้องจากฐานข้อมูลสีที่มีอยู่แล้วมาโชว์
    if (window.SINGER_COLORS) {
        Object.keys(window.SINGER_COLORS).forEach(s => allSingers.add(s));
    }

    // 2. พยายามดึงชื่อจากข้อมูลศิลปินในเพลงเผื่อไว้ด้วย
    if (window.songs) {
        window.songs.forEach(song => {
            if (song.artist) song.artist.split(',').forEach(s => allSingers.add(s.trim()));
        });
    }

    // 3. สร้างหน้าต่าง Modal 
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#222; padding:20px; border-radius:10px; z-index:9999; width:380px; box-shadow:0 0 20px rgba(0,0,0,0.8); border: 1px solid #444; color:#fff;';
    
    let html = '<h3 style="margin-top:0; border-bottom:1px solid #444; padding-bottom:10px;">🎨 ตั้งค่าสีนักร้อง</h3>';
    
    // ✨ ฟีเจอร์ใหม่: ช่องให้แอดมินพิมพ์เพิ่มชื่อนักร้องเองได้เลย!
    html += `
        <div style="margin-bottom: 15px; background: #333; padding: 10px; border-radius: 6px;">
            <div style="font-size: 0.8em; margin-bottom: 5px; color: #aaa;">➕ เพิ่มนักร้องใหม่ / หาไม่เจอพิมพ์เองเลย:</div>
            <div style="display:flex; gap:10px;">
                <input type="text" id="newSingerName" placeholder="พิมพ์ชื่อ..." style="flex:1; padding:5px; border-radius:3px; border:none; outline:none; font-family: inherit;">
                <input type="color" id="newSingerColor" value="#ff0000" style="cursor:pointer; background:none; border:none; height:25px; width:30px;">
                <button id="btnAddManualSinger" style="background:#28a745; color:white; border:none; padding:5px 15px; border-radius:3px; cursor:pointer;">เพิ่ม</button>
            </div>
        </div>
        <div id="singerListContainer" style="max-height:50vh; overflow-y:auto; padding-right:5px;">
    `;
    
    // สร้างรายการนักร้องทั้งหมด (เรียงตามตัวอักษร)
    Array.from(allSingers).sort().forEach(singer => {
        if(!singer || singer === 'ดนตรี') return;
        const currentColor = window.SINGER_COLORS[singer] || '#0a84ff';
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:#333; padding:8px; border-radius:6px;">
                <span style="font-size:0.9em;">${singer}</span>
                <input type="color" class="color-input" data-name="${singer}" value="${currentColor}" style="cursor:pointer; background:none; border:none; height:30px; width:40px;">
            </div>
        `;
    });

    html += `
        </div>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button id="btnSaveColors" style="flex:1; background:#0a84ff; border:none; padding:10px; color:#fff; border-radius:5px; cursor:pointer;">💾 บันทึกทั้งหมด</button>
            <button id="btnCloseColors" style="flex:1; background:#555; border:none; padding:10px; color:#fff; border-radius:5px; cursor:pointer;">❌ ปิด</button>
        </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    // ==========================================
    // จัดการปุ่มกดต่างๆ
    // ==========================================
    document.getElementById('btnCloseColors').onclick = () => document.body.removeChild(modal);
    
    // โค้ดทำงานของปุ่ม ➕ เพิ่มนักร้องเอง
    document.getElementById('btnAddManualSinger').onclick = () => {
        const name = document.getElementById('newSingerName').value.trim();
        const color = document.getElementById('newSingerColor').value;
        if (!name) return alert('กรุณาพิมพ์ชื่อนักร้องก่อนครับ 😅');
        
        window.SINGER_COLORS = window.SINGER_COLORS || {};
        window.SINGER_COLORS[name] = color; 
        
        document.body.removeChild(modal);
        openSingerColorManager(db); // ปิดแล้วเปิดใหม่เพื่อรีเฟรชรายการ
    };

    // โค้ดทำงานของปุ่ม 💾 บันทึกลงฐานข้อมูล
    document.getElementById('btnSaveColors').onclick = async () => {
        document.getElementById('btnSaveColors').innerText = 'กำลังบันทึก...';
        const newColors = { ...window.SINGER_COLORS };
        
        document.querySelectorAll('.color-input').forEach(input => {
            const singerName = input.getAttribute('data-name');
            newColors[singerName] = input.value;
        });

        try {
            const colorDocRef = doc(db, 'settings', 'singerColors');
            // ใช้ setDoc แบบ merge เพื่อความปลอดภัยสูงสุด
            await setDoc(colorDocRef, newColors, { merge: true }); 
            
            window.SINGER_COLORS = newColors;
            document.body.removeChild(modal);
            alert('บันทึกสีสำเร็จ! 🎉');
            if (window.renderLyricsToContainer) window.renderLyricsToContainer();
        } catch (error) {
            console.error(error);
            alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            document.getElementById('btnSaveColors').innerText = '💾 บันทึกทั้งหมด';
        }
    };
}
