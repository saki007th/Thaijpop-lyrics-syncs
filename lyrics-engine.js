// ==========================================
// 🎤 Lyrics Engine (ระบบปาดสีคาราโอเกะ - แก้บั๊กสมบูรณ์)
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

    buildKaraokeLine: function(lineDiv, lyric, wordDataArray, song, index) {
        let linesHtml = ""; let wordIdx = 0;
        let lines = lyric.split('\n').filter(l => l.trim() !== '');
        
        lines.forEach((l, i) => {
            const isMiddle = (i > 0 && i < lines.length - 1);
            const hlClass = isMiddle ? ' reading-text' : ''; 

            if (l.includes('||')) {
                let parts = l.split('||');
                let mainStr = parts[0];
                let subStr = parts[1] ? parts[1].replace(/\|/g, '').trim() : '';

                let mainWords = mainStr.split(/(\s+|\|)/).filter(w => w !== '' && w !== '|');
                let mainWipeHtml = `<span class="lyric-main" style="display:inline-flex; flex-wrap:wrap; justify-content:center;">`;
                let lastTime = 0;

                mainWords.forEach((word) => {
                    if (word.trim() === '') { mainWipeHtml += `<span>&nbsp;</span>`; return; }
                    let wData = wordDataArray[wordIdx];
                    let t = (wData && wData.t) ? wData.t : lastTime + 0.2; // 🟢 แก้บั๊กเวลา: ถ้าเวลาหาย ให้บวกเพิ่มจากคำก่อนหน้า
                    lastTime = t;

                    let nextData = wordDataArray[wordIdx + 1];
                    let endTime = (nextData && nextData.t) ? nextData.t : (t + 0.4); 
                    
                    mainWipeHtml += `
                        <span class="k-word-group" style="position:relative; display:inline-block;" data-start="${t}" data-end="${endTime}">
                            <span style="color:transparent;">${word}</span>
                            <span style="position:absolute; left:0; top:0; color:inherit;">${word}</span>
                            <span class="k-fill" style="color:#0a84ff; position:absolute; left:0; top:0; width:0%; overflow:hidden; white-space:pre; text-shadow: 0 0 10px #0a84ff;">${word}</span>
                        </span>
                    `;
                    wordIdx++;
                });
                mainWipeHtml += `</span>`;
                let subHtml = subStr ? `<span class="lyric-sub">${subStr}</span>` : '';
                linesHtml += `<div class="lang-${i} dual-lyric${hlClass}">${mainWipeHtml}${subHtml}</div>`;
            } 
            else {
                if (i === 0) { 
                    let mainWords = l.split(/(\s+|\|)/).filter(w => w !== '' && w !== '|');
                    let mainWipeHtml = "";
                    let lastTime = 0; // 🟢 ตัวจำเวลาคำก่อนหน้า

                    mainWords.forEach((word) => {
                        if (word.trim() === '') { mainWipeHtml += `<span>&nbsp;</span>`; return; }
                        
                        // 🟢 ดึงเวลา หรือถ้าไม่มีให้บวกจากคำเก่า (ป้องกันสีขึ้นพร้อมกัน)
                        let wData = wordDataArray[wordIdx];
                        let t = (wData && wData.t) ? wData.t : lastTime + 0.2; 
                        lastTime = t;

                        let nextData = wordDataArray[wordIdx + 1];
                        let endTime = (nextData && nextData.t) ? nextData.t : (t + 0.4); 
                        
                        // 🟢 แก้บั๊กตัวอักษรแหว่ง: ใช้ color:transparent เป็นฐานดันกล่องให้กว้างเป๊ะ 100%
                        mainWipeHtml += `
                            <span class="k-word-group" style="position:relative; display:inline-block;" data-start="${t}" data-end="${endTime}">
                                <span style="color:transparent;">${word}</span>
                                <span style="position:absolute; left:0; top:0; color:inherit;">${word}</span>
                                <span class="k-fill" style="color:#0a84ff; position:absolute; left:0; top:0; width:0%; overflow:hidden; white-space:pre; text-shadow: 0 0 10px #0a84ff;">${word}</span>
                            </span>
                        `;
                        wordIdx++;
                    });
                    linesHtml += `<div class="lang-${i}${hlClass}">${mainWipeHtml}</div>`;
                } else {
                    linesHtml += `<div class="lang-${i}${hlClass}">${l.replace(/\|/g, '')}</div>`;
                }
            }
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
        // 🟢 แก้บั๊กกรอกลับ: สั่งเช็คคำทั้งหมดบนหน้าจอ ไม่ใช่แค่บรรทัดที่ร้องอยู่
        const allWordGroups = document.querySelectorAll('.k-word-group');
        allWordGroups.forEach(group => {
            const start = parseFloat(group.getAttribute('data-start'));
            const end = parseFloat(group.getAttribute('data-end'));
            
            let progress = 0;
            if (cTime >= end) {
                progress = 100; // ร้องผ่านไปแล้ว ระบายเต็ม
            } else if (cTime >= start && cTime < end) {
                progress = ((cTime - start) / (end - start)) * 100; // กำลังร้อง ค่อยๆ ปาด
            } else {
                progress = 0; // 🟢 ยังไม่ร้อง หรือกรอกลับมา ให้ลบสีทิ้งเป็น 0%
            }
            
            const fill = group.querySelector('.k-fill');
            if (fill) fill.style.width = progress + '%';
        });
    }
};
