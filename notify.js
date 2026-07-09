/* ========================================================
   🔔 ระบบแจ้งเตือนอัปเดตเพลงใหม่ย้อนหลัง 7 วัน (notify.js)
   ======================================================== */

// 1. ฟังก์ชันช่วยแปลงเวลา (Timestamp) ให้เป็นกลุ่มวัน เช่น วันนี้, เมื่อวาน, หรือวันที่
function getRelativeDayLabel(timestamp) {
    const songDate = new Date(timestamp);
    const today = new Date();
    
    // เซ็ตเวลาเป็น 00:00 เพื่อเทียบแค่วันที่ ไม่เอาชั่วโมงมาคิด
    const songZero = new Date(songDate.getFullYear(), songDate.getMonth(), songDate.getDate());
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = todayZero - songZero;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "🔥 เพิ่มวันนี้ (Today)";
    if (diffDays === 1) return "⏳ เพิ่มเมื่อวาน (Yesterday)";
    if (diffDays <= 7) return `📅 ย้อนหลัง ${diffDays} วันที่แล้ว`;
    
    return songDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// 2. ฟังก์ชันเปิดหน้าต่างแจ้งเตือนเพลงใหม่ (WinBox)
window.openNotifyWindow = function() {
    // 🔴 อ่านแล้ว -> ซ่อนจุดแดงแจ้งเตือนทันที
    const badge = document.getElementById('notifyBadge');
    if (badge) badge.style.display = 'none';
    
    // บันทึกเวลาที่กดดูล่าสุดลงในเครื่องผู้ใช้ เอาไว้เช็คจุดแดงในครั้งต่อไป
    localStorage.setItem('lastCheckedNotify', Date.now());

    // ถ้าหน้าต่างเปิดอยู่แล้ว ให้โฟกัสแทน ไม่เปิดซ้อน
    if (window.wm && window.wm.notifyWin) {
        window.wm.notifyWin.focus();
        return;
    }

    // คำนวณเวลาถอยหลัง 7 วัน (7 วัน = 7 * 24 * 60 * 60 * 1000 มิลลิวินาที)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // กรองเอาเฉพาะเพลงที่มี createdAt และมีอายุไม่เกิน 7 วัน
    const newSongs = (window.songs || []).filter(song => song.createdAt && song.createdAt >= sevenDaysAgo);

    // เรียงลำดับจากเพลงที่เพิ่มล่าสุด ขึ้นก่อน
    newSongs.sort((a, b) => b.createdAt - a.createdAt);

    // เริ่มวาดโครงสร้าง HTML ด้านในหน้าต่าง
    let htmlContent = `<div style="padding: 15px; color: #fff; font-family: sans-serif; max-height: 100%; overflow-y: auto;">`;
    
    if (newSongs.length === 0) {
        // กรณีไม่มีเพลงใหม่เลยใน 7 วัน
        htmlContent += `
            <div style="text-align: center; padding: 50px 10px; color: #888;">
                <div style="font-size: 45px; margin-bottom: 15px;">📭</div>
                <div style="font-size: 0.95em;">ยังไม่มีเพลงใหม่เข้าคลัง<br>ในรอบ 7 วันนี้ครับ</div>
            </div>`;
    } else {
        // จัดกลุ่มเพลงตามกลุ่มวัน
        const groupedSongs = {};
        newSongs.forEach(song => {
            const label = getRelativeDayLabel(song.createdAt);
            if (!groupedSongs[label]) groupedSongs[label] = [];
            groupedSongs[label].push(song);
        });

        // วนลูปวาดรายการเพลงตามกลุ่มวัน
        for (const [dayLabel, songs] of Object.entries(groupedSongs)) {
            htmlContent += `
                <div style="margin-bottom: 20px;">
                    <div style="font-weight: bold; color: #ffcc00; margin-bottom: 10px; font-size: 0.9em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">${dayLabel}</div>
            `;
            
        songs.forEach(song => {
                // ==========================================
                // ✨ เพิ่มระบบดึงรูปปกจาก YouTube
                // ==========================================
                const videoId = window.extractYouTubeID ? window.extractYouTubeID(song.audioPath) : '';
                const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

                htmlContent += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.06); padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.02);">
                        
                        <img src="${thumbUrl}" onerror="this.style.display='none'" style="width: 45px; height: 45px; object-fit: cover; border-radius: 8px; margin-right: 12px; flex-shrink: 0; background: #222; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">
                        
                        <div style="flex: 1; min-width: 0; margin-right: 10px;">
                            <div style="font-weight: bold; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff;">${song.title}</div>
                            <div style="font-size: 0.75em; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">🎤 ${song.artist || 'ไม่ระบุศิลปิน'}</div>
                        </div>
                        <button onclick="window.playSong('${song.id}'); if(window.wm.notifyWin) window.wm.notifyWin.close();" 
                                style="background: #00d2ff; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; transition: transform 0.1s;"
                                onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">▶️</button>
                    </div>
                `;
            });
            
            htmlContent += `</div>`;
        }
    }
    
    htmlContent += `</div>`;

    // สั่งเปิดหน้าต่าง WinBox
    if (window.WinBox) {
        const mountDiv = document.createElement('div');
        mountDiv.innerHTML = htmlContent;

        window.wm = window.wm || {};
        window.wm.notifyWin = new WinBox("🔔 มีอะไรใหม่ย้อนหลัง 7 วัน", {
            mount: mountDiv,
            width: "350px",
            height: "430px",
            x: "left",
            y: "bottom",
            bottom: 100, // ดันให้ลอยอยู่เหนือปุ่มกระดิ่งนิดหน่อย จะได้ไม่บังกัน
            left: 30,
            class: ["wb-dark", "no-min"],
            onclose: () => {
                window.wm.notifyWin = null;
            }
        });
    }
};

// 3. ฟังก์ชันเช็คเพลงใหม่เพื่อเปิดจุดแดง (เรียกใช้อัตโนมัติเวลาแอปโหลดเพลงเสร็จ)
window.checkNewSongsNotification = function() {
    const badge = document.getElementById('notifyBadge');
    if (!badge || !window.songs || window.songs.length === 0) return;

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const lastChecked = parseInt(localStorage.getItem('lastCheckedNotify') || '0');

    // ตรวจสอบว่ามีเพลงที่เพิ่มภายใน 7 วัน และเพิ่มหลังจากผู้ใช้กดดูครั้งล่าสุดไหม
    const hasNewSong = window.songs.some(song => 
        song.createdAt && 
        song.createdAt >= sevenDaysAgo && 
        song.createdAt > lastChecked
    );

    if (hasNewSong) {
        badge.style.display = 'block'; // โชว์จุดแดงกระพริบ
    } else {
        badge.style.display = 'none';  // ซ่อนจุดแดง
    }
};
