document.addEventListener('DOMContentLoaded', () => {
    const timelineContent = document.querySelector('.timeline-content');
    const playhead = document.querySelector('.playhead');
    const timelineRuler = document.querySelector('.timeline-ruler');
    const timecodeDisplay = document.getElementById('timecode');
    const playBtn = document.getElementById('play-btn');

    let isDraggingPlayhead = false;
    let isPlaying = false;
    let currentTime = 0; // Current time in seconds
    let lastTimestamp = 0;
    
    const TRACK_LABEL_WIDTH = 60;
    let pixelsPerSecond = 50; // Dynamic zoom level
    const CLIP_DEFAULT_DURATION = 3; // 3 seconds per image

    // Initialize Ruler
    function initRuler() {
        if (!timelineRuler) return;
        timelineRuler.innerHTML = '';
        const duration = 300; // 5 minutes max for now
        
        // Calculate step based on zoom
        let step = 1;
        if (pixelsPerSecond < 10) step = 10;
        if (pixelsPerSecond < 2) step = 30;
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

    function updateUI() {
        // Update Playhead
        playhead.style.left = (TRACK_LABEL_WIDTH + currentTime * pixelsPerSecond) + 'px';
        
        // Update Timecode
        if (timecodeDisplay) {
            timecodeDisplay.textContent = `${formatTime(currentTime)} / 00:00:00`;
        }

        // Update all clips based on new scale
        const clips = document.querySelectorAll('.timeline-clip');
        clips.forEach(clip => {
            const start = parseFloat(clip.dataset.startTime);
            const duration = parseFloat(clip.dataset.duration);
            clip.style.left = (start * pixelsPerSecond) + 'px';
            clip.style.width = (duration * pixelsPerSecond) + 'px';
        });

        // Trigger preview update
        window.dispatchEvent(new CustomEvent('timelineUpdate', { detail: { time: currentTime } }));
    }

    function setTime(newTime) {
        currentTime = Math.max(0, newTime);
        updateUI();
    }

    // Zoom Logic
    if (timelineContent) {
        timelineContent.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                pixelsPerSecond = Math.min(Math.max(1, pixelsPerSecond * zoomFactor), 2000);
                initRuler();
                updateUI();
            }
        }, { passive: false });
    }

    // Playback Logic
    function togglePlay() {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause';
            lastTimestamp = performance.now();
            requestAnimationFrame(playLoop);
        } else {
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play';
        }
    }

    function playLoop(timestamp) {
        if (!isPlaying) return;
        const dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;
        setTime(currentTime + dt);
        requestAnimationFrame(playLoop);
    }

    if (playBtn) playBtn.addEventListener('click', togglePlay);

    // Interactivity for seeking
    if (timelineContent) {
        timelineContent.addEventListener('mousedown', (e) => {
            if (e.offsetY < 24 || e.target.classList.contains('timeline-ruler')) {
                isDraggingPlayhead = true;
                handleSeek(e.clientX);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingPlayhead) handleSeek(e.clientX);
        });

        window.addEventListener('mouseup', () => {
            isDraggingPlayhead = false;
        });
    }

    function handleSeek(clientX) {
        const rect = timelineContent.getBoundingClientRect();
        const scrollLeft = timelineContent.scrollLeft;
        const relativeX = clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
        setTime(relativeX / pixelsPerSecond);
    }

    // Sequential Add Clip Logic
    window.addClipToTimeline = function(src, name, type = 'video') {
        const track = document.querySelector(`.track.${type} .track-content`);
        if (!track) return;

        const existingClips = track.querySelectorAll('.timeline-clip');
        let nextStartTime = 0;
        if (existingClips.length > 0) {
            const lastClip = existingClips[existingClips.length - 1];
            nextStartTime = parseFloat(lastClip.dataset.startTime) + parseFloat(lastClip.dataset.duration);
        }

        const clip = document.createElement('div');
        clip.className = `timeline-clip ${type}`;
        clip.dataset.startTime = nextStartTime;
        clip.dataset.duration = CLIP_DEFAULT_DURATION;
        
        const img = document.createElement('img');
        img.src = src;
        img.className = 'clip-thumb';
        
        const title = document.createElement('span');
        title.className = 'clip-title';
        title.textContent = name;
        
        clip.appendChild(img);
        clip.appendChild(title);
        track.appendChild(clip);

        updateUI();

        // Clip Dragging Logic
        let isDraggingClip = false;
        let startX;
        let originalStartTime;

        clip.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDraggingClip = true;
            startX = e.clientX;
            originalStartTime = parseFloat(clip.dataset.startTime);
            clip.style.zIndex = '100';
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingClip) {
                const dx = e.clientX - startX;
                const dt = dx / pixelsPerSecond;
                clip.dataset.startTime = Math.max(0, originalStartTime + dt);
                updateUI();
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingClip) {
                isDraggingClip = false;
                clip.style.zIndex = '';
            }
        });
    };

    initRuler();
    updateUI();
});
