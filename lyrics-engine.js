// ==========================================
// 🎤 Lyrics Engine (ระบบประมวลผลเนื้อเพลงแบบปาดสีคาราโอเกะ)
// ==========================================

window.LyricsEngine = {
    render: function() {
        const container = document.getElementById('lyricsContainer'); 
        if(!container) return;
        container.innerHTML = ''; 

        const song = window.songs.find(s => s.id === window.currentSongId);
        if (!song) return;

        let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
        let karaokeData = isCover ? (song.covers[window.currentCoverIndex].karaokeData) : song.karaokeData;

        // 🔀 สวิตช์สลับราง!
        if (karaokeData && karaokeData.length > 0) {
            console.log("🟢 ใช้งานโหมด: ปาดสีคาราโอเกะ");
            this.renderKaraokeMode(song, karaokeData);
        } else {
            console.log("🟡 ใช้งานโหมด: คลาสสิก (ดั้งเดิม)");
            this.renderClassicMode(song);
        }
    },

    // 🚀 โหมดที่ 1: ระบบใหม่ (รอเชื่อมระบบปาดสี)
    renderKaraokeMode: function(song, karaokeData) {
        const container = document.getElementById('lyricsContainer');
        container.innerHTML = '<div style="color: #ffcc00; text-align: center; margin-top: 50px; font-size: 1.5em;">กำลังเตรียมระบบปาดสีคาราโอเกะ... 🚀</div>';
    },

    // 🛡️ โหมดที่ 2: ระบบเก่า (ยกของเดิมมาไว้ที่นี่ ปลอดภัย 100%)
    renderClassicMode: function(song) {
        const container = document.getElementById('lyricsContainer');
        if (window.currentLyricsArray.length === 0) { container.innerHTML = 'ไม่มีเนื้อเพลง'; return; }

        window.currentLyricsArray.forEach((lyric, index) => {
            const lineDiv = document.createElement('div'); lineDiv.className = 'lyric-line'; lineDiv.id = `lyric-line-${index}`;
            
            lineDiv.onclick = () => {
                const activeSong = window.songs.find(s => s.id === window.currentSongId);
                if (activeSong && window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
                    const activeTimestamps = window.getActiveTimestamps(activeSong);
                    if (activeTimestamps[index] != null) {
                        window.ytPlayer.seekTo(activeTimestamps[index], true);
                        window.currentLyricIndex = index;
                        window.updateLyricDisplay();
                    }
                }
            };
            
            let linesHtml = "";
            const cleanLyric = lyric.trim();
            
            if (cleanLyric === '[ดนตรี]') {
                linesHtml = `
                    <div class="lyric-instrumental">
                        <span class="note">🎵</span><span class="note">🎶</span><span class="note">🎵</span>
                    </div>
                `;
            } else {
                const validLines = cleanLyric.split('\n').filter(l => l.trim() !== '');
                linesHtml = validLines.map((l, i) => {
                    const isMiddle = (i > 0 && i < validLines.length - 1);
                    const highlightClass = isMiddle ? ' reading-text' : ''; 
                    if (l.includes('||')) {
                        let parts = l.split('||');
                        return `<div class="lang-${i} dual-lyric${highlightClass}"><span class="lyric-main">${parts[0].trim()}</span><span class="lyric-sub">${parts[1].trim()}</span></div>`;
                    } else {
                        return `<div class="lang-${i}${highlightClass}">${l}</div>`;
                    }
                }).join('');
            }

            const activeSingers = window.getActiveSingers(song);
            const singerString = activeSingers[index] || null;

            if (singerString && cleanLyric !== '[ดนตรี]') { 
                const badgesHtml = singerString.split(',').filter(s=>s.trim()).map(s => {
                    const name = s.trim();
                    const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[name]) ? window.SINGER_COLORS[name] : '#0a84ff';
                    return `<span class="singer-badge" style="background-color: ${badgeColor}; color: #fff; border: 1px solid rgba(255,255,255,0.2);">${name}</span>`;
                }).join('');
                lineDiv.innerHTML = `<div class="singer-badges">${badgesHtml}</div>${linesHtml}`;
            } else { 
                lineDiv.innerHTML = linesHtml; 
            }
            
            container.appendChild(lineDiv);
        });
    }
};
