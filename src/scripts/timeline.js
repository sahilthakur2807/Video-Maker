document.addEventListener('DOMContentLoaded', () => {
    const timelineContent = document.querySelector('.timeline-content');
    const playhead = document.querySelector('.playhead');
    const timelineRuler = document.querySelector('.timeline-ruler');
    const timecodeDisplay = document.getElementById('timecode');
    const playBtn = document.getElementById('play-btn');

    let isDraggingPlayhead = false;
    let isPlaying = false;
    let currentTime = 0;
    let lastTimestamp = 0;
    
    const TRACK_LABEL_WIDTH = 60;
    let pixelsPerSecond = 50;
    const CLIP_DEFAULT_DURATION = 3;

    function initRuler() {
        if (!timelineRuler) return;
        timelineRuler.innerHTML = '';
        const duration = 300;
        let step = 1;
        if (pixelsPerSecond < 10) step = 10;
        if (pixelsPerSecond > 200) step = 0.1;

        for (let i = 0; i <= duration; i += step) {
            const mark = document.createElement('div');
            mark.className = 'ruler-mark' + (i % (step * 5) === 0 ? ' major' : '');
            mark.style.left = (TRACK_LABEL_WIDTH + i * pixelsPerSecond) + 'px';
            timelineRuler.appendChild(mark);
            if (i % (step * 10) === 0) {
                const label = document.createElement('div');
                label.className = 'ruler-label';
                label.style.left = (TRACK_LABEL_WIDTH + i * pixelsPerSecond) + 'px';
                label.textContent = formatTime(i);
                timelineRuler.appendChild(label);
            }
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    function recalculateLayout() {
        const tracks = document.querySelectorAll('.track-content');
        tracks.forEach(track => {
            const clips = Array.from(track.querySelectorAll('.timeline-clip'));
            let currentStart = 0;
            clips.forEach(clip => {
                clip.dataset.startTime = currentStart;
                currentStart += parseFloat(clip.dataset.duration);
            });
        });
    }

    function getTotalDuration() {
        const clips = document.querySelectorAll('.timeline-clip');
        let maxEnd = 0;
        clips.forEach(clip => {
            const end = parseFloat(clip.dataset.startTime) + parseFloat(clip.dataset.duration);
            if (end > maxEnd) maxEnd = end;
        });
        return maxEnd;
    }

    function updateUI() {
        recalculateLayout();
        const totalDuration = getTotalDuration();
        playhead.style.left = (TRACK_LABEL_WIDTH + currentTime * pixelsPerSecond) + 'px';
        if (timecodeDisplay) timecodeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
        document.querySelectorAll('.timeline-clip').forEach(clip => {
            const start = parseFloat(clip.dataset.startTime);
            const duration = parseFloat(clip.dataset.duration);
            clip.style.left = (start * pixelsPerSecond) + 'px';
            clip.style.width = (duration * pixelsPerSecond) + 'px';
        });
        window.dispatchEvent(new CustomEvent('timelineUpdate', { detail: { time: currentTime } }));
    }
    
    window.updateTimelineUI = updateUI;
    window.isTimelinePlaying = () => isPlaying;

    function setTime(newTime) {
        currentTime = Math.max(0, newTime);
        updateUI();
    }

    function togglePlay() {
        if (!isPlaying && document.querySelectorAll('.timeline-clip.video').length === 0) {
            alert('Please add at least one image before playing.');
            return;
        }
        isPlaying = !isPlaying;
        if (isPlaying) {
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause';
            lastTimestamp = performance.now();
            requestAnimationFrame(playLoop);
        } else {
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play';
            document.querySelectorAll('audio').forEach(a => a.pause());
        }
    }

    function playLoop(timestamp) {
        if (!isPlaying) return;
        const totalDuration = getTotalDuration();
        const dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;
        if (currentTime + dt >= totalDuration) {
            setTime(totalDuration);
            togglePlay();
            return;
        }
        setTime(currentTime + dt);
        requestAnimationFrame(playLoop);
    }

    if (playBtn) playBtn.addEventListener('click', togglePlay);

    if (timelineContent) {
        timelineContent.addEventListener('mousedown', (e) => {
            if (e.offsetY < 24 || e.target.classList.contains('timeline-ruler')) {
                isDraggingPlayhead = true;
                handleSeek(e.clientX);
            }
        });
        window.addEventListener('mousemove', (e) => { if (isDraggingPlayhead) handleSeek(e.clientX); });
        window.addEventListener('mouseup', () => { isDraggingPlayhead = false; });
    }

    function handleSeek(clientX) {
        const rect = timelineContent.getBoundingClientRect();
        const relativeX = clientX - rect.left + timelineContent.scrollLeft - TRACK_LABEL_WIDTH;
        setTime(relativeX / pixelsPerSecond);
    }

    window.addClipToTimeline = function(src, name, type = 'video', audioSrc = null) {
        const track = document.querySelector(`.track.${type} .track-content`);
        if (!track) return;
        const clip = document.createElement('div');
        clip.className = `timeline-clip ${type}`;
        
        if (type === 'video') {
            clip.dataset.duration = CLIP_DEFAULT_DURATION;
            clip.dataset.brightness = "100"; clip.dataset.contrast = "100"; clip.dataset.saturation = "100";
            clip.dataset.filter = "none"; clip.dataset.anim = "none";
            const img = document.createElement('img');
            img.src = src; img.className = 'clip-thumb';
            clip.appendChild(img);
        } else if (type === 'audio') {
            clip.dataset.duration = 5;
            const audio = document.createElement('audio');
            audio.src = audioSrc;
            audio.preload = 'auto';
            audio.autoplay = false;
            clip.appendChild(audio);
            audio.onloadedmetadata = () => { clip.dataset.duration = audio.duration; updateUI(); };
            const icon = document.createElement('span'); icon.innerHTML = '🎵 ';
            clip.appendChild(icon);
            
            const handle = document.createElement('div');
            handle.className = 'trim-handle right';
            clip.appendChild(handle);

            let isTrimming = false; let sX; let sDur;
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation(); isTrimming = true; sX = e.clientX;
                sDur = parseFloat(clip.dataset.duration);
            });
            window.addEventListener('mousemove', (e) => {
                if (isTrimming) {
                    const dx = e.clientX - sX;
                    clip.dataset.duration = Math.max(0.1, sDur + (dx / pixelsPerSecond));
                    updateUI();
                }
            });
            window.addEventListener('mouseup', () => isTrimming = false);
        } else if (type === 'text') {
            clip.dataset.duration = CLIP_DEFAULT_DURATION;
            clip.dataset.text = src; // 'src' will be the actual text for type='text'
            const icon = document.createElement('span'); icon.innerHTML = 'T ';
            clip.appendChild(icon);
        }
        
        const title = document.createElement('span');
        title.className = 'clip-title'; title.textContent = name;
        clip.appendChild(title);
        track.appendChild(clip);

        const selectClip = () => {
            document.querySelectorAll('.timeline-clip').forEach(c => c.classList.remove('selected'));
            clip.classList.add('selected');
            window.dispatchEvent(new CustomEvent('clipSelected', { detail: { clip: clip } }));
        };

        selectClip();
        clip.addEventListener('click', (e) => { e.stopPropagation(); selectClip(); });

        let isDraggingClip = false; let startX; let originalStartTime;
        clip.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('trim-handle')) return;
            e.stopPropagation(); isDraggingClip = true; startX = e.clientX;
            originalStartTime = parseFloat(clip.dataset.startTime);
            clip.style.zIndex = '100'; selectClip();
        });
        window.addEventListener('mousemove', (e) => {
            if (isDraggingClip) {
                const dx = e.clientX - startX; const dt = dx / pixelsPerSecond;
                clip.style.left = (TRACK_LABEL_WIDTH + (originalStartTime + dt) * pixelsPerSecond) + 'px';
            }
        });
        window.addEventListener('mouseup', () => {
            if (isDraggingClip) { isDraggingClip = false; clip.style.zIndex = ''; updateUI(); }
        });
        updateUI();
    };

    initRuler();
    updateUI();
});
