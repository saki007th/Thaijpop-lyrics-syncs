// ==========================================
// 🎤 Lyrics Engine (ระบบประมวลผลเนื้อเพลงแบบปาดสีคาราโอเกะ)
// ==========================================

window.LyricsEngine = {
    // ฟังก์ชันนี้จะคอยเช็คว่า "เพลงนี้ควรเล่นโหมดไหน?"
    render: function() {
        const container = document.getElementById('lyricsContainer'); 
        if(!container) return;
        container.innerHTML = ''; 

        const song = window.songs.find(s => s.id === window.currentSongId);
        if (!song) return;

        // เช็คว่ากำลังเล่น Cover หรือ Original
        let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
        
        // 🔴 มองหากระเป๋าใบใหม่ชื่อ "karaokeData" (ถ้ามี)
        let karaokeData = isCover ? (song.covers[window.currentCoverIndex].karaokeData) : song.karaokeData;

        // 🔀 สวิตช์สลับราง!
        if (karaokeData && karaokeData.length > 0) {
            console.log("🟢 ใช้งานโหมด: ปาดสีคาราโอเกะ (แยกคำ)");
            this.renderKaraokeMode(song, karaokeData);
        } else {
            console.log("🟡 ใช้งานโหมด: คลาสสิก (แยกบรรทัด)");
            this.renderClassicMode(song);
        }
    },

    // 🚀 โหมดที่ 1: ระบบใหม่ (รอเขียนโค้ดปาดสีซ้ายไปขวาตรงนี้)
    renderKaraokeMode: function(song, karaokeData) {
        const container = document.getElementById('lyricsContainer');
        container.innerHTML = '<div style="color: #ffcc00; text-align: center; margin-top: 50px; font-size: 1.5em;">กำลังเตรียมระบบปาดสีคาราโอเกะ... 🚀</div>';
    },

    // 🛡️ โหมดที่ 2: ระบบเก่า (รันโค้ดเก่าของคุณ 100% ไม่มีการเปลี่ยนแปลง)
    renderClassicMode: function(song) {
        // เดี๋ยวเราจะย้ายโค้ด renderLyricsToContainer ตัวเดิมจาก app.js มาเก็บไว้ที่นี่ เพื่อให้มันทำงานได้เหมือนเดิมเป๊ะๆ ครับ
        const container = document.getElementById('lyricsContainer');
        container.innerHTML = '<div style="color: #ccc; text-align: center; margin-top: 50px;">(ระบบคลาสสิกกำลังทำงาน)</div>';
    }
};
