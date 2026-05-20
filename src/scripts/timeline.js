document.addEventListener('DOMContentLoaded', () => {
    const timelineContent = document.querySelector('.timeline-content');
    const playhead = document.querySelector('.playhead');
    const timelineRuler = document.querySelector('.timeline-ruler');
    const timecodeDisplay = document.getElementById('timecode');

    let isDraggingPlayhead = false;
    const TRACK_LABEL_WIDTH = 60;
    const PIXELS_PER_SECOND = 50;

    // Initialize Ruler
    function initRuler() {
        if (!timelineRuler) return;
        timelineRuler.innerHTML = '';
        const duration = 120; // 2 minutes for now
        
        for (let i = 0; i <= duration; i++) {
            const mark = document.createElement('div');
            mark.className = 'ruler-mark' + (i % 5 === 0 ? ' major' : '');
            mark.style.left = (TRACK_LABEL_WIDTH + i * PIXELS_PER_SECOND) + 'px';
            timelineRuler.appendChild(mark);

            if (i % 10 === 0) {
                const label = document.createElement('div');
                label.className = 'ruler-label';
                label.style.left = (TRACK_LABEL_WIDTH + i * PIXELS_PER_SECOND) + 'px';
                label.textContent = formatTime(i);
                timelineRuler.appendChild(label);
            }
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updatePlayhead(x) {
        const rect = timelineContent.getBoundingClientRect();
        let scrollLeft = timelineContent.scrollLeft;
        let relativeX = x - rect.left + scrollLeft;
        
        if (relativeX < TRACK_LABEL_WIDTH) relativeX = TRACK_LABEL_WIDTH;
        
        playhead.style.left = relativeX + 'px';
        
        const seconds = (relativeX - TRACK_LABEL_WIDTH) / PIXELS_PER_SECOND;
        if (timecodeDisplay) {
            timecodeDisplay.textContent = `${formatTime(seconds)} / 00:00:00`;
        }
    }

    // Interactivity
    if (timelineContent) {
        timelineContent.addEventListener('mousedown', (e) => {
            if (e.offsetY < 24 || e.target.classList.contains('timeline-ruler')) { // Clicking ruler area
                isDraggingPlayhead = true;
                updatePlayhead(e.clientX);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingPlayhead) {
                updatePlayhead(e.clientX);
            }
        });

        window.addEventListener('mouseup', () => {
            isDraggingPlayhead = false;
        });
    }

    initRuler();

    // Export a function to add clips to the professional timeline
    window.addClipToTimeline = function(src, name, type = 'video') {
        const track = document.querySelector(`.track.${type} .track-content`);
        if (!track) return;

        // Calculate next sequential position
        const existingClips = track.querySelectorAll('.timeline-clip');
        let nextLeft = 0;
        if (existingClips.length > 0) {
            const lastClip = existingClips[existingClips.length - 1];
            const lastClipLeft = parseInt(lastClip.style.left) || 0;
            const lastClipWidth = 150; // Current fixed width
            nextLeft = lastClipLeft + lastClipWidth;
        }

        const clip = document.createElement('div');
        clip.className = `timeline-clip ${type}`;
        clip.style.left = nextLeft + 'px'; 
        clip.style.width = '150px'; // Fixed width for now
        
        const img = document.createElement('img');
        img.src = src;
        img.className = 'clip-thumb';
        
        const title = document.createElement('span');
        title.className = 'clip-title';
        title.textContent = name;
        
        clip.appendChild(img);
        clip.appendChild(title);
        
        track.appendChild(clip);

        // Simple drag for clip
        let isDraggingClip = false;
        let startX;
        let startLeft;

        clip.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDraggingClip = true;
            startX = e.clientX;
            startLeft = parseInt(clip.style.left);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingClip) {
                const dx = e.clientX - startX;
                let newLeft = startLeft + dx;
                if (newLeft < 0) newLeft = 0;
                clip.style.left = newLeft + 'px';
            }
        });

        window.addEventListener('mouseup', () => {
            isDraggingClip = false;
        });
    };
});
