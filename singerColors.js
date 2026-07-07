// ดึงคำสั่งที่จำเป็นจาก Firebase
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ฟังก์ชันสำหรับเช็คและสร้างสีเริ่มต้น
export async function initializeSingerColors(db) {
    // เตรียมตัวแปร Global ไว้รอรับสี
    window.SINGER_COLORS = {}; 
    
    // ชี้เป้าไปที่แฟ้มใหม่: Collection "settings" -> Document "singerColors"
    const colorDocRef = doc(db, 'settings', 'singerColors');

    try {
        const docSnap = await getDoc(colorDocRef);

        if (docSnap.exists()) {
            // ✅ ถ้ามีแฟ้มนี้อยู่แล้ว -> โหลดสีมาใช้ได้เลย
            window.SINGER_COLORS = docSnap.data();
            console.log("🎨 โหลดสีนักร้องสำเร็จ!");
        } else {
            // 🛠️ ถ้ายังไม่มีแฟ้ม (เปิดเว็บครั้งแรก) -> สร้างให้เลยอัตโนมัติ!
            console.log("🛠️ ไม่พบฐานข้อมูลสี... กำลังสร้างแฟ้มใหม่อัตโนมัติ");
            
            const defaultColors = {
                "Tokoyami Towa": "#FF69B4",
                "Yozora Mel": "#FFD700",
                "Hoshimachi Suisei": "#87CEEB",
                "Minato Aqua": "#FFB6C1",
                "Nekomata Okayu": "#9370DB"
            };
            
            // บันทึกลง Firebase
            await setDoc(colorDocRef, defaultColors);
            
            // นำมาใช้งาน
            window.SINGER_COLORS = defaultColors;
            console.log("✅ สร้างแฟ้มสีเริ่มต้นเรียบร้อย!");
        }
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการโหลดสี:", error);
    }
}
// ดึงคำสั่งแก้ไขข้อมูลเพิ่มเติมจาก Firebase
import { updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ฟังก์ชันเปิดหน้าต่างตั้งค่าสี
export async function openSingerColorManager(db) {
    // 1. ดึงชื่อนักร้องทั้งหมดจากเพลงที่มีในคลัง
    const allSingers = new Set();
    if (window.songs) {
        window.songs.forEach(song => {
            if (song.lyrics) {
                // ค้นหาชื่อนักร้องทั้งหมดจากเนื้อเพลง
                const matches = song.lyrics.match(/\[(.*?)\]/g);
                if (matches) {
                    matches.forEach(m => {
                        const singers = m.replace('[', '').replace(']', '').split(',');
                        singers.forEach(s => {
                            if (s.trim() !== 'ดนตรี' && s.trim() !== '') {
                                allSingers.add(s.trim());
                            }
                        });
                    });
                }
            }
        });
    }

    // 2. สร้างหน้าต่าง Modal ขึ้นมากลางจอ
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#222; padding:20px; border-radius:10px; z-index:9999; width:350px; max-height:80vh; overflow-y:auto; box-shadow:0 0 20px rgba(0,0,0,0.8); border: 1px solid #444; color:#fff;';
    
    let html = '<h3 style="margin-top:0; border-bottom:1px solid #444; padding-bottom:10px;">🎨 ตั้งค่าสีนักร้อง</h3>';
    
    Array.from(allSingers).sort().forEach(singer => {
        const currentColor = window.SINGER_COLORS[singer] || '#0a84ff';
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:#333; padding:8px; border-radius:6px;">
                <span style="font-size:0.9em;">${singer}</span>
                <input type="color" id="color_${singer}" value="${currentColor}" style="cursor:pointer; background:none; border:none; height:30px; width:40px;">
            </div>
        `;
    });

    html += `
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button id="btnSaveColors" style="flex:1; background:#0a84ff; border:none; padding:10px; color:#fff; border-radius:5px; cursor:pointer;">💾 บันทึก</button>
            <button id="btnCloseColors" style="flex:1; background:#555; border:none; padding:10px; color:#fff; border-radius:5px; cursor:pointer;">❌ ปิด</button>
        </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    // 3. จัดการปุ่มกดต่างๆ
    document.getElementById('btnCloseColors').onclick = () => document.body.removeChild(modal);
    
    document.getElementById('btnSaveColors').onclick = async () => {
        document.getElementById('btnSaveColors').innerText = 'กำลังบันทึก...';
        const newColors = { ...window.SINGER_COLORS };
        
        allSingers.forEach(singer => {
            const colorVal = document.getElementById(`color_${singer}`).value;
            newColors[singer] = colorVal;
        });

        try {
            // อัปเดตลงฐานข้อมูล
            const colorDocRef = doc(db, 'settings', 'singerColors');
            await updateDoc(colorDocRef, newColors);
            
            // อัปเดตในเครื่อง และรีเฟรชหน้าจอ
            window.SINGER_COLORS = newColors;
            document.body.removeChild(modal);
            alert('บันทึกสีสำเร็จ! 🎉');
            if (window.renderLyricsToContainer) window.renderLyricsToContainer();
        } catch (error) {
            console.error(error);
            alert('❌ เกิดข้อผิดพลาดในการบันทึก');
            document.getElementById('btnSaveColors').innerText = '💾 บันทึก';
        }
    };
}
