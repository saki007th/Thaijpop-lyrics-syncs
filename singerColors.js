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
