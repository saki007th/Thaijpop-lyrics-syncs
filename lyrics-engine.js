// ==========================================
// 🎤 Lyrics Engine (ระบบ Auto-Wipe ปาดสี 0-100% อัตโนมัติ)
// ==========================================

window.LyricsEngine = {
    animationFrame: null,
    
    render: function() {
        const container = document.getElementById('lyricsContainer'); if(!container) return;
        container.innerHTML = ''; 
        const song = window.songs.find(s => s.id === window.currentSongId); if (!song) return;

        window.currentLyricsArray.forEach((lyric, index) => {
            const lineDiv = document.createElement('div'); 
            lineDiv.className = 'lyric-line'; lineDiv.id = `lyric-line-${index}`;
            
            lineDiv.onclick = () => {
                const activeSong = window.songs.find(s => s.id === window.currentSongId);
                if (activeSong && window.ytPlayer && typeof window.ytPlayer.seekTo === 'function') {
                    const activeTs = window.getActiveTimestamps(activeSong);
                    if (activeTs[index] != null) { window.ytPlayer.seekTo(activeTs[index], true); window.currentLyricIndex = index; window.updateLyricDisplay(); }
                }
            };
            
            this.buildAutoWipeLine(lineDiv, lyric, song, index);
            container.appendChild(lineDiv);
        });

        this.startEngine();
    },

    buildAutoWipeLine: function(lineDiv, lyric, song, index) {
        let linesHtml = ""; const cleanLyric = lyric.trim();
        if (cleanLyric === '[ดนตรี]') {
            linesHtml = `<div class="lyric-instrumental"><span class="note">🎵</span><span class="note">🎶</span><span class="note">🎵</span></div>`;
        } else {
            const validLines = cleanLyric.split('\n').filter(l => l.trim() !== '');
            linesHtml = validLines.map((l, i) => {
                const isMiddle = (i > 0 && i < validLines.length - 1);
                const hlClass = isMiddle ? ' reading-text' : ''; 
                
                // จัดการแยกคำหลักและคำแปล
                let mainStr = l.replace(/\|/g, '').trim();
                let subStr = '';
                if (l.includes('||')) {
                    let parts = l.split('||');
                    mainStr = parts[0].replace(/\|/g, '').trim();
                    subStr = parts[1] ? parts[1].replace(/\|/g, '').trim() : '';
                }

                // 🟢 สร้างตัวหนังสือ 2 เลเยอร์ซ้อนกัน (ฐานสีเทา + ตัวปาดสีฟ้า)
                let wipeHtml = `
                    <span class="line-wipe-group" style="position:relative; display:inline-block;">
                        <span style="color:inherit; opacity:0.5;">${mainStr}</span>
                        <span class="k-fill" style="color:#0a84ff; position:absolute; left:0; top:0; white-space:nowrap; overflow:hidden; clip-path:inset(0 100% 0 0); text-shadow: 0 0 10px #0a84ff;">${mainStr}</span>
                    </span>
                `;

                if (subStr) {
                    return `<div class="lang-${i} dual-lyric${hlClass}">${wipeHtml}<span class="lyric-sub">${subStr}</span></div>`;
                } else { 
                    return `<div class="lang-${i}${hlClass}">${wipeHtml}</div>`; 
                }
            }).join('');
        }
        this.appendSingers(lineDiv, linesHtml, cleanLyric, song, index);
    },

    appendSingers: function(lineDiv, linesHtml, cleanLyric, song, index) {
        const activeSingers = window.getActiveSingers(song);
        const singerString = activeSingers[index] || null;
        if (singerString && cleanLyric !== '[ดนตรี]') { 
            const badgesHtml = singerString.split(',').filter(s=>s.trim()).map(s => {
                const name = s.trim(); const badgeColor = (window.SINGER_COLORS && window.SINGER_COLORS[name]) ? window.SINGER_COLORS[name] : '#0a84ff';
                return `<span class="singer-badge" style="background-color: ${badgeColor}; color: #fff; border: 1px solid rgba(255,255,255,0.2);">${name}</span>`;
            }).join('');
            lineDiv.innerHTML = `<div class="singer-badges">${badgesHtml}</div>${linesHtml}`;
        } else { lineDiv.innerHTML = linesHtml; }
    },

    startEngine: function() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        const loop = () => {
            if (window.ytPlayer && typeof window.ytPlayer.getCurrentTime === 'function') {
                this.updateWipe(window.ytPlayer.getCurrentTime());
            }
            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    },

    updateWipe: function(cTime) {
        const song = window.songs.find(s => s.id === window.currentSongId);
        if (!song) return;
        const activeTs = window.getActiveTimestamps(song);
        if (!activeTs || activeTs.length === 0) return;

        window.currentLyricsArray.forEach((_, index) => {
            const lineDiv = document.getElementById(`lyric-line-${index}`);
            if (!lineDiv) return;

            let start = activeTs[index];
            if (start == null) return;

            // 🟢 คำนวณระยะเวลา (Duration) ไปหาบรรทัดถัดไป
            let end = null;
            for (let j = index + 1; j < activeTs.length; j++) {
                if (activeTs[j] != null) { end = activeTs[j]; break; }
            }
            
            // ถ้าเป็นท่อนสุดท้าย หรือท่อนต่อไปอยู่ไกลเกินไป ให้ปาดจบใน 4 วินาที (ป้องกันการปาดช้าเกินไป)
            let duration = end ? (end - start) : 4.0;
            if (duration > 5) duration = 5; 
            if (duration <= 0) duration = 0.1;

            let progress = 0;
            if (cTime >= start + duration) {
                progress = 100; // ร้องผ่านไปแล้ว ปาดสีเต็ม 100%
            } else if (cTime >= start && cTime < start + duration) {
                progress = ((cTime - start) / duration) * 100; // กำลังร้อง ค่อยๆ ขยับ 0-100%
            } else {
                progress = 0; // ยังไม่ร้อง
            }

            // สั่งขยับแถบสี (Clip-Path) ให้เหมือนแถบสไลด์
            const fills = lineDiv.querySelectorAll('.k-fill');
            fills.forEach(fill => {
                fill.style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
            });
        });
    }
};
