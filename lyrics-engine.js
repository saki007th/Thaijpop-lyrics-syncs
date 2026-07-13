// ==========================================
// 🎤 Lyrics Engine (ระบบลูกผสม Hybrid & Wiping Animation สีฟ้า)
// ==========================================

window.LyricsEngine = {
    animationFrame: null,
    
    render: function() {
        const container = document.getElementById('lyricsContainer'); if(!container) return;
        container.innerHTML = ''; 
        const song = window.songs.find(s => s.id === window.currentSongId); if (!song) return;

        let isCover = (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]);
        let karaokeData = isCover ? (song.covers[window.currentCoverIndex].karaokeData || []) : (song.karaokeData || []);

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
            
            // 🔀 ตรวจสอบทีละบรรทัด (Hybrid Check)
            if (karaokeData[index] && karaokeData[index].length > 0) {
                this.buildKaraokeLine(lineDiv, lyric, karaokeData[index], song, index);
            } else {
                this.buildClassicLine(lineDiv, lyric, song, index);
            }
            container.appendChild(lineDiv);
        });

        this.startEngine();
    },

    buildClassicLine: function(lineDiv, lyric, song, index) {
        let linesHtml = ""; const cleanLyric = lyric.trim();
        if (cleanLyric === '[ดนตรี]') {
            linesHtml = `<div class="lyric-instrumental"><span class="note">🎵</span><span class="note">🎶</span><span class="note">🎵</span></div>`;
        } else {
            const validLines = cleanLyric.split('\n').filter(l => l.trim() !== '');
            linesHtml = validLines.map((l, i) => {
                const isMiddle = (i > 0 && i < validLines.length - 1);
                const hlClass = isMiddle ? ' reading-text' : ''; 
                // ถึงไม่มีระบบซับแล้ว แต่ยังคงเคลียร์เครื่องหมาย | เผื่อแอดมินพิมพ์ทิ้งไว้
                return `<div class="lang-${i}${hlClass}">${l.replace(/\|/g, '')}</div>`;
            }).join('');
        }
        this.appendSingers(lineDiv, linesHtml, cleanLyric, song, index);
    },

    buildKaraokeLine: function(lineDiv, lyric, wordDataArray, song, index) {
        let linesHtml = ""; let wordIdx = 0;
        let lines = lyric.split('\n').filter(l => l.trim() !== '');
        
        lines.forEach(l => {
            let mainWords = l.split(/(\s+|\|)/).filter(w => w !== '' && w !== '|');

            let rowHtml = `<div class="k-row" style="display:flex; flex-wrap:wrap; justify-content:center; align-items:flex-end; gap:6px; margin-bottom:8px;">`;
            
            mainWords.forEach((word) => {
                if (word.trim() === '') { rowHtml += `<span>&nbsp;</span>`; return; }
                
                let wData = wordDataArray[wordIdx] || { t: 0 };
                let nextData = wordDataArray[wordIdx + 1];
                let endTime = nextData ? nextData.t : (wData.t + 0.8); // กะเวลาจบคำ
                
                rowHtml += `
                    <div class="k-word-group" style="display:inline-flex; flex-direction:column; align-items:center;" data-start="${wData.t}" data-end="${endTime}">
                        <span style="position:relative; font-size:1.1em; color:rgba(255,255,255,0.5); font-weight:bold;">
                            ${word}
                            <span class="k-fill" style="color:#0a84ff; position:absolute; left:0; top:0; width:0%; overflow:hidden; white-space:nowrap; text-shadow: 0 0 10px #0a84ff;">${word}</span>
                        </span>
                    </div>
                `;
                wordIdx++;
            });
            rowHtml += `</div>`;
            linesHtml += rowHtml;
        });
        
        this.appendSingers(lineDiv, linesHtml, lyric.trim(), song, index);
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
        const activeLine = document.querySelector('.lyric-line.active');
        if (!activeLine) return;

        const wordGroups = activeLine.querySelectorAll('.k-word-group');
        wordGroups.forEach(group => {
            const start = parseFloat(group.getAttribute('data-start'));
            const end = parseFloat(group.getAttribute('data-end'));
            
            let progress = 0;
            if (cTime >= end) progress = 100;
            else if (cTime >= start && cTime < end) {
                progress = ((cTime - start) / (end - start)) * 100; 
            }
            
            const fills = group.querySelectorAll('.k-fill');
            fills.forEach(fill => { fill.style.width = progress + '%'; });
        });
    }
};
