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
// 2. ฟังก์ชันเปิดหน้าต่างแอดมิน (ลากได้ + โปร่งแสง + Auto-Save)
// ==========================================
export async function openSingerColorManager(db) {
    // 🔴 1. ป้องกันหน้าต่างซ้อน: เช็คว่ามีหน้าต่างเดิมไหม ถ้ามีให้ลบทิ้งก่อน
    const existingModal = document.getElementById('singerColorModal');
    if (existingModal) existingModal.remove();

    const allSingers = new Set();
    
    // ดึงรายชื่อนักร้อง
    if (window.SINGER_COLORS) {
        Object.keys(window.SINGER_COLORS).forEach(s => allSingers.add(s));
    }
    if (window.songs) {
        window.songs.forEach(song => {
            if (song.artist) song.artist.split(',').forEach(s => allSingers.add(s.trim()));
        });
    }

    // สร้างหน้าต่าง UI
    const modal = document.createElement('div');
    modal.id = 'singerColorModal'; // ตั้ง ID ให้หน้าต่างเพื่อเอาไว้เช็ค
    modal.style.cssText = `
        position: fixed;
        top: 15vh;
        left: calc(50% - 200px);
        width: 400px;
        background: rgba(25, 25, 25, 0.65);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        border-radius: 16px;
        z-index: 9999;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.15);
        color: #fff;
        font-family: inherit;
    `;
    
    let html = `
        <div id="modalDragHandle" style="cursor: grab; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); border-radius: 16px 16px 0 0;">
            <h3 style="margin: 0; text-align: center; font-size: 1.2em; pointer-events: none;">🎨 ตั้งค่าสีนักร้อง</h3>
        </div>
        <div style="padding: 20px;">
    `;
    
    // ช่องเพิ่มนักร้องใหม่
    html += `
        <div style="margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 0.85em; margin-bottom: 10px; color: #ccc;">➕ เพิ่มนักร้องใหม่ / หาไม่เจอพิมพ์เองเลย:</div>
            <div style="display:flex; gap:10px;">
                <input type="text" id="newSingerName" placeholder="พิมพ์ชื่อศิลปิน..." style="flex:1; padding:10px 12px; border-radius:8px; border:none; outline:none; background: rgba(255,255,255,0.1); color: #fff;">
                <input type="color" id="newSingerColor" value="#0a84ff" style="cursor:pointer; background:none; border:none; height:36px; width:36px; padding:0; border-radius:6px;">
                <button id="btnAddManualSinger" style="background:#0a84ff; color:white; border:none; padding:0 18px; border-radius:8px; cursor:pointer; font-weight:bold;">เพิ่ม</button>
            </div>
        </div>
        <div id="singerListContainer" style="max-height:45vh; overflow-y:auto; padding-right:8px; margin-bottom: 10px;">
    `;
    
    // สร้างรายการนักร้องทั้งหมด
    Array.from(allSingers).sort().forEach(singer => {
        if(!singer || singer === 'ดนตรี') return;
        const currentColor = window.SINGER_COLORS[singer] || '#ffffff';
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:rgba(0,0,0,0.2); padding:10px 15px; border-radius:10px;">
                <span id="preview_${singer}" style="font-size:1em; font-weight:bold; color:${currentColor}; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">${singer}</span>
                <div style="display:flex; align-items:center; gap: 10px;">
                    <span id="hex_${singer}" style="font-size:0.75em; color:#aaa; font-family:monospace;">${currentColor}</span>
                    <input type="color" class="color-input" data-name="${singer}" value="${currentColor}" style="cursor:pointer; background:none; border:none; height:30px; width:34px; padding:0;">
                </div>
            </div>
        `;
    });

    // 🔴 2. ตัดปุ่มบันทึกออก เหลือแค่ปุ่มปิด
    html += `
        </div>
        <div style="display:flex; margin-top:20px;">
            <button id="btnCloseColors" style="width:100%; background:rgba(255,255,255,0.15); border:none; padding:12px; color:#fff; border-radius:10px; cursor:pointer; font-weight:bold; transition:0.2s;">❌ ปิด</button>
        </div>
        </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    // ==========================================
    // ฟังก์ชันย่อยสำหรับเซฟลง Firebase
    // ==========================================
    const saveColorToDatabase = async (newColorsDict) => {
        try {
            const colorDocRef = doc(db, 'settings', 'singerColors');
            await setDoc(colorDocRef, newColorsDict, { merge: true }); 
            window.SINGER_COLORS = newColorsDict;
            if (window.renderLyricsToContainer) window.renderLyricsToContainer();
        } catch (error) {
            console.error(error);
            alert('❌ เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
        }
    };

    // ==========================================
    // 🖱️ ระบบลากหน้าต่าง
    // ==========================================
    const dragHandle = document.getElementById('modalDragHandle');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragHandle.style.cursor = 'grabbing';
        startX = e.clientX;
        startY = e.clientY;
        const rect = modal.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        e.preventDefault(); 
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        modal.style.left = `${initialLeft + dx}px`;
        modal.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        dragHandle.style.cursor = 'grab';
    });

    // ==========================================
    // 👁️ ระบบ Live Preview และ 💾 Auto-Save 
    // ==========================================
    document.querySelectorAll('.color-input').forEach(input => {
        // 1. แค่เลื่อนสี -> พรีวิวหน้าจอเปลี่ยนทันที (ยังไม่เซฟ กันฐานข้อมูลทำงานหนัก)
        input.addEventListener('input', (e) => {
            const singerName = e.target.getAttribute('data-name');
            const newColor = e.target.value;
            const previewEl = document.getElementById(`preview_${singerName}`);
            const hexEl = document.getElementById(`hex_${singerName}`);
            if (previewEl) previewEl.style.color = newColor;
            if (hexEl) hexEl.innerText = newColor;
        });

        // 2. ปล่อยเมาส์จากการเลือกสี -> เซฟลงฐานข้อมูลอัตโนมัติ!
        input.addEventListener('change', async (e) => {
            const singerName = e.target.getAttribute('data-name');
            const newColor = e.target.value;
            const newColors = { ...window.SINGER_COLORS };
            newColors[singerName] = newColor;
            
            // เรียกฟังก์ชันเซฟเงียบๆ
            await saveColorToDatabase(newColors);
        });
    });

    // ==========================================
    // จัดการปุ่มกดต่างๆ
    // ==========================================
    document.getElementById('btnCloseColors').onclick = () => document.body.removeChild(modal);
    
    // ปุ่มเพิ่มนักร้องเอง (เซฟอัตโนมัติเช่นกัน)
    document.getElementById('btnAddManualSinger').onclick = async () => {
        const name = document.getElementById('newSingerName').value.trim();
        const color = document.getElementById('newSingerColor').value;
        if (!name) return alert('กรุณาพิมพ์ชื่อนักร้องก่อนครับ 😅');
        
        const newColors = { ...window.SINGER_COLORS };
        newColors[name] = color; 
        
        await saveColorToDatabase(newColors);
        
        // โหลดหน้าต่างใหม่เพื่อโชว์ชื่อที่เพิ่งแอด
        document.body.removeChild(modal);
        openSingerColorManager(db); 
    };
}
