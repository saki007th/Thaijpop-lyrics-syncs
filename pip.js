// ==========================================
// pip.js - ระบบหน้าต่างเนื้อเพลงลอยอิสระ (Document Picture-in-Picture)
// อัปเดต: คืนขนาดฟอนต์ + Auto-scale + ดึง CSS ลูกเล่นพิเศษ (ดนตรี, ป้ายชื่อ, คอรัส) กลับมา!
// ==========================================

let pipWindow = null;
let lastTrackKey = null; 

window.togglePiPMode = async function() {
    if (!('documentPictureInPicture' in window)) {
        alert('เบราว์เซอร์ของคุณยังไม่รองรับระบบหน้าต่างลอยอิสระครับ \n(แนะนำ Google Chrome บน PC)');
        return;
    }

    if (pipWindow) {
        pipWindow.close();
        return;
    }

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400,
            height: 480 
        });

        // 1. ใส่สไตล์ CSS
        const style = document.createElement('style');
        style.textContent = `
            body { 
                margin: 0; padding: 0; background: #0a0a0c; color: #fff; 
                display: flex; flex-direction: column; 
                height: 100vh; overflow: hidden; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                transition: background 0.5s ease;
            }
            
            /* =========================================
               🎧 โหมดเริ่มต้น (Full Layout)
               ========================================= */
            #pip-header {
                display: flex; align-items: center; gap: 15px;
                padding: 20px 20px;
                background: rgba(255, 255, 255, 0.05);
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
            }
            #pip-cover {
                width: 65px; height: 65px;
                border-radius: 12px; object-fit: cover;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                background: #1c1c1e; 
                display: none; 
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
            }
            #pip-info {
                display: flex; flex-direction: column; justify-content: center;
                flex: 1; overflow: hidden;
                transition: all 0.6s ease;
            }
            #pip-title {
                font-size: 17px; font-weight: bold; color: #0a84ff;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                transition: all 0.6s ease;
            }
            #pip-artist {
                font-size: 13px; color: #8e8e93; margin-top: 4px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                max-height: 20px; opacity: 1;
                transition: all 0.4s ease;
            }
            #pip-timer {
                font-family: monospace; font-size: 13px; color: #aaa;
                font-weight: bold; text-align: right;
                opacity: 0; transform: translateX(10px);
                max-width: 0; overflow: hidden;
                transition: all 0.6s cubic-bezier(0.25, 1, 0.5, 1);
            }
            #pip-progress-container {
                width: 100%; height: 4px;
                background: rgba(255, 255, 255, 0.08);
                transition: all 0.6s ease;
            }
            #pip-progress-bar {
                width: 0%; height: 100%;
                background: #0a84ff; 
                transition: width 0.2s linear, background 0.6s ease, box-shadow 0.6s ease; 
            }

            /* =========================================
               🚀 โหมดเล่นเพลง (Compact Mode)
               ========================================= */
            body.compact-mode #pip-header { padding: 12px 15px; background: transparent; }
            body.compact-mode #pip-cover { width: 32px; height: 32px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
            body.compact-mode #pip-title { font-size: 15px; color: #fff; }
            body.compact-mode #pip-artist { opacity: 0; max-height: 0; margin-top: 0; }
            body.compact-mode #pip-timer { opacity: 1; transform: translateX(0); max-width: 100px; }
            body.compact-mode #pip-progress-container { height: 1px; background: rgba(255,255,255,0.15); box-shadow: 0 0 10px rgba(10, 132, 255, 0.3); }
            body.compact-mode #pip-progress-bar { background: #00d2ff; box-shadow: 0 0 8px #00d2ff; }

            /* =========================================
               📝 พื้นที่เนื้อเพลง
               ========================================= */
            #pip-lyrics {
                flex-grow: 1; 
                display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                padding: 15px; 
                text-align: center; box-sizing: border-box;
                background: radial-gradient(circle at center, #1c1c1e 0%, #0a0a0c 100%);
                width: 100%; overflow: hidden; 
            }
            
            #current-lyric-text {
                font-size: clamp(16px, 6vmin, 46px); 
                font-weight: 800; 
                line-height: 1.25; 
                width: 100%;
                word-wrap: break-word; overflow-wrap: break-word; white-space: normal;
                transition: font-size 0.15s ease; 
            }

            /* ตัวหนังสือธรรมดาทั่วไป */
            #current-lyric-text > div:not(.singer-badges):not(.lyric-instrumental):not(.dual-lyric) { 
                color: #ffffff !important; 
                text-shadow: 0 2px 8px rgba(0,0,0,0.8);
                display: block; 
                margin-bottom: 8px; 
            }
            /* จัดการภาษาซับไตเติ้ล (บรรทัดที่ไม่ใช่ภาษาแรก) */
            #current-lyric-text > div:not(:first-child):not(.singer-badges):not(.lyric-instrumental):not(.dual-lyric) {
                font-size: 0.75em; 
                color: #a0a0a5 !important; 
                font-weight: 600;
                line-height: 1.15;
            }

            /* =========================================
               🎵 ลูกเล่นพิเศษ: ดนตรี, ป้ายชื่อ, คอรัส 
               ========================================= */
            
            /* 1. ท่อนดนตรี */
            .lyric-instrumental {
                display: flex; justify-content: center; align-items: center; gap: 15px; font-size: 1.5em; height: 60px;
            }
            .lyric-instrumental .note {
                color: #00d2ff !important; opacity: 0.5; animation: bounceNote 1.2s infinite ease-in-out alternate;
            }
            .lyric-instrumental .note:nth-child(2) { animation-delay: 0.3s; }
            .lyric-instrumental .note:nth-child(3) { animation-delay: 0.6s; }
            @keyframes bounceNote {
                0% { transform: translateY(0) scale(1); opacity: 0.3; }
                100% { transform: translateY(-10px) scale(1.2); opacity: 1; color: #fff; filter: drop-shadow(0 0 10px #00d2ff); }
            }

            /* 2. ป้ายชื่อนักร้อง */
            .singer-badges { display: flex; gap: 8px; margin-bottom: 15px; justify-content: center; flex-wrap: wrap; }
            .singer-badge { 
                font-size: 0.5em; /* ย่อให้เหมาะกับ PiP */
                padding: 6px 14px; border-radius: 20px; 
                color: #fff; border: 1px solid rgba(255,255,255,0.8);
                box-shadow: 0 0 10px rgba(255,255,255,0.5); 
                text-shadow: none !important;
            }

            /* 3. ท่อนร้องประสาน (Dual Lyric สีรุ้ง) */
            .dual-lyric { display: flex; flex-direction: column; align-items: center; width: 100%; margin-bottom: 10px; }
            .lyric-main { text-align: center; width: 100%; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
            .lyric-sub {
                display: block; text-align: center;
                background: linear-gradient(90deg, #ff9a9e, #fecfef, #a1c4fd, #c2e9fb, #ff9a9e);
                background-size: 200% auto;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent !important;
                animation: rainbowFlow 4s linear infinite;
                font-size: 0.75em; font-style: italic; font-weight: bold;
                max-width: 90%; word-wrap: break-word; margin-top: 4px;
            }
            @keyframes rainbowFlow {
                0% { background-position: 0% center; }
                100% { background-position: 200% center; }
            }
        `;
        pipWindow.document.head.appendChild(style);

        // 2. สร้างโครงสร้างหน้าต่าง (HTML) 
        pipWindow.document.body.innerHTML = `
            <div id="pip-header">
                <img id="pip-cover" src="" alt="cover">
                <div id="pip-info">
                    <div id="pip-title">กำลังรอเพลง...</div>
                    <div id="pip-artist">🎤 -</div>
                </div>
                <div id="pip-timer">00:00</div>
            </div>
            <div id="pip-progress-container">
                <div id="pip-progress-bar"></div>
            </div>
            <div id="pip-lyrics">
                <div id="current-lyric-text">
                    <span style="color:#8e8e93 !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>
                </div>
            </div>
        `;

        const formatTime = (seconds) => {
            if (isNaN(seconds) || seconds < 0) return "00:00";
            const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60);
            return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
        };

        pipWindow.lastLyricIndex = -1;

        // 3. ระบบอัปเดตข้อมูลแบบ Real-time
        pipWindow.syncInterval = setInterval(() => {
            if (!window.currentSongId || !window.songs) return;
            const song = window.songs.find(s => s.id === window.currentSongId);
            if (!song) return;
            
            let currentKey = song.id + "_" + (window.currentCoverIndex || -1);

            if (lastTrackKey !== currentKey) {
                lastTrackKey = currentKey;
                pipWindow.lastLyricIndex = -1; 
                
                pipWindow.document.getElementById('current-lyric-text').innerHTML = '<span style="color:#8e8e93 !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>';
                
                let targetVideoPath = song.audioPath;
                let displayArtist = song.artist || 'ไม่ระบุศิลปิน';
                
                if (window.currentCoverIndex >= 0 && song.covers && song.covers[window.currentCoverIndex]) {
                    targetVideoPath = song.covers[window.currentCoverIndex].audioPath;
                    if(song.covers[window.currentCoverIndex].coverArtist) displayArtist = song.covers[window.currentCoverIndex].coverArtist;
                }

                pipWindow.document.getElementById('pip-title').innerText = song.title;
                pipWindow.document.getElementById('pip-artist').innerText = `🎤 ${displayArtist}`;
                
                const coverImg = pipWindow.document.getElementById('pip-cover');
                const ytId = window.extractYouTubeID(targetVideoPath);
                if (ytId) {
                    coverImg.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                    coverImg.style.display = 'block';
                } else {
                    coverImg.style.display = 'none';
                }
            }

            if (window.currentLyricIndex !== pipWindow.lastLyricIndex) {
                pipWindow.lastLyricIndex = window.currentLyricIndex;
                
                const activeLine = document.querySelector('.lyric-line.active');
                const lyricBox = pipWindow.document.getElementById('current-lyric-text');
                const wrapper = pipWindow.document.getElementById('pip-lyrics');

                if (activeLine) {
                    lyricBox.innerHTML = activeLine.innerHTML;
                } else {
                    lyricBox.innerHTML = '<span style="color:#8e8e93 !important; text-shadow:none;">🎵 กำลังรอเนื้อเพลง...</span>';
                }

                lyricBox.style.fontSize = ''; 
                
                setTimeout(() => {
                    if (!pipWindow || !pipWindow.document) return;
                    
                    let currentSize = parseFloat(pipWindow.getComputedStyle(lyricBox).fontSize);
                    
                    while (lyricBox.scrollHeight > wrapper.clientHeight - 20 && currentSize > 14) {
                        currentSize -= 1;
                        lyricBox.style.fontSize = currentSize + 'px';
                    }
                }, 10);
            }

            const playerObj = window.ytPlayer || window.player; 
            if (playerObj && typeof playerObj.getCurrentTime === 'function') {
                const currentTime = playerObj.getCurrentTime();
                const duration = playerObj.getDuration();
                
                if (duration > 0) {
                    const percent = (currentTime / duration) * 100;
                    pipWindow.document.getElementById('pip-progress-bar').style.width = `${percent}%`;
                }

                pipWindow.document.getElementById('pip-timer').innerText = `${formatTime(currentTime)} / ${formatTime(duration)}`;

                if (currentTime > 3) {
                    pipWindow.document.body.classList.add('compact-mode');
                } else {
                    pipWindow.document.body.classList.remove('compact-mode');
                }
            }

        }, 150); 

        // 4. ล้างข้อมูลเมื่อปิดหน้าต่าง
        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipWindow.syncInterval); 
            lastTrackKey = null;
            pipWindow = null;
        });

    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปิด PiP:', error);
    }
};
