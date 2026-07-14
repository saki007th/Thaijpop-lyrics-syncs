// ==========================================
// 🎤 Lyrics Engine (ระบบปาดสีระดับพิกเซล - ทีละตัวอักษร)
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
                if (l.includes('||')) {
                    let parts = l.split('||');
                    return `<div class="lang-${i} dual-lyric${hlClass}"><span class="lyric-main">${parts[0].replace(/\|/g, '').trim()}</span><span class="lyric-sub">${parts[1]?parts[1].replace(/\|/g, '').trim():''}</span></div>`;
                } else { 
                    return `<div class="lang-${i}${hlClass}">${l.replace(/\|/g, '')}</div>`; 
                }
            }).join('');
        }
        this.appendSingers(lineDiv, linesHtml, cleanLyric, song, index);
    },

    buildKaraokeLine: function(lineDiv, lyric, charDataArray, song, index) {
        let linesHtml = ""; let charIdx = 0;
        let lines = lyric.split('\n').filter(l => l.trim() !== '');
        
        lines.forEach((l, i) => {
            const isMiddle = (i > 0 && i < lines.length - 1);
            const hlClass = isMiddle ? ' reading-text' : ''; 

            if (l.includes('||')) {
                let parts = l.split('||');
                let mainStr = parts[0].replace(/\|/g, '');
                let subStr = parts[1] ? parts[1].replace(/\|/g, '').trim() : '';
                
                let result = this.generateWipeHtml(mainStr, charDataArray, charIdx);
                linesHtml += `<div class="lang-${i} dual-lyric${hlClass}">${result.html}<span class="lyric-sub">${subStr}</span></div>`;
                charIdx = result.nextIdx;
            } 
            else {
                if (i === 0) { 
                    let result = this.generateWipeHtml(l.replace(/\|/g, ''), charDataArray, charIdx);
                    linesHtml += `<div class="lang-${i}${hlClass}">${result.html}</div>`;
                    charIdx = result.nextIdx;
                } else {
                    linesHtml += `<div class="lang-${i}${hlClass}">${l.replace(/\|/g, '')}</div>`;
                }
            }
        });
        
        this.appendSingers(lineDiv, linesHtml, lyric.trim(), song, index);
    },

    // 🟢 ฟังก์ชันสร้างกล่องปาดสีระดับตัวอักษร
    generateWipeHtml: function(textLine, charDataArray, startCharIdx) {
        const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
        let characters = Array.from(segmenter.segment(textLine)).map(s => s.segment);
        
        let html = `<span class="lyric-main" style="display:inline-flex; flex-wrap:wrap; justify-content:center;">`;
        let lastTime = 0; 
        let cIdx = startCharIdx;

        characters.forEach((char) => {
            if (char.trim() === '') { html += `<span>&nbsp;</span>`; return; }
            
            let cData = charDataArray[cIdx];
            let t = (cData && cData.t) ? cData.t : lastTime + 0.1; // เวลาสั้นลงเพราะเป็นตัวอักษร
            lastTime = t;

            let nextData = charDataArray[cIdx + 1];
            let endTime = (nextData && nextData.t) ? nextData.t : (t + 0.2); 
            
            html += `
                <span class="k-word-group" style="position:relative; display:inline-block;" data-start="${t}" data-end="${endTime}">
                    <span style="color:inherit; opacity:0.6;">${char}</span>
                    <span class="k-fill" style="color:#0a84ff; position:absolute; left:0; top:0; white-space:nowrap; clip-path:inset(0 100% 0 0); text-shadow: 0 0 10px #0a84ff;">${char}</span>
                </span>
            `;
            cIdx++;
        });
        html += `</span>`;
        return { html: html, nextIdx: cIdx };
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
        const allWordGroups = document.querySelectorAll('.k-word-group');
        allWordGroups.forEach(group => {
            const start = parseFloat(group.getAttribute('data-start'));
            const end = parseFloat(group.getAttribute('data-end'));
            
            let progress = 0;
            let duration = end - start;
            if (duration <= 0) duration = 0.05; 
            
            if (cTime >= end) {
                progress = 100;
            } else if (cTime >= start && cTime < end) {
                progress = ((cTime - start) / duration) * 100;
            } else {
                progress = 0;
            }
            
            const fill = group.querySelector('.k-fill');
            if (fill) fill.style.clipPath = `inset(0 ${100 - progress}% 0 0)`;
        });
    }
};
