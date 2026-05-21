document.addEventListener('DOMContentLoaded', () => {
    const addMediaBtn = document.getElementById('add-media-btn');
    const mediaInput = document.getElementById('media-upload-input');
    const canvasArea = document.getElementById('canvas-area');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const sidebarItems = document.querySelectorAll('.sidebar-item');

    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            sidebarItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const type = item.querySelector('span').textContent.toLowerCase();
            if (type === 'audio') mediaInput.accept = 'audio/*';
            else if (type === 'videos') mediaInput.accept = 'video/*';
            else mediaInput.accept = 'image/*';
        });
    });

    if (addMediaBtn && mediaInput) {
        addMediaBtn.addEventListener('click', () => mediaInput.click());
    }

    if (mediaInput) {
        mediaInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.addClipToTimeline) {
                        if (file.type.startsWith('image/')) {
                            window.addClipToTimeline(event.target.result, file.name, 'video');
                        } else if (file.type.startsWith('audio/')) {
                            window.addClipToTimeline(null, file.name, 'audio', event.target.result);
                        }
                    }
                };
                reader.readAsDataURL(file);
            });
        });
    }

    function previewImage(src, forceRecreate = false) {
        if (previewPlaceholder) previewPlaceholder.style.display = 'none';
        const existingPreview = document.getElementById('active-preview');
        if (existingPreview) {
            if (!forceRecreate && existingPreview.src === src) return existingPreview;
            existingPreview.remove();
        }
        const img = document.createElement('img');
        img.id = 'active-preview';
        img.src = src;
        img.style.maxWidth = '100%'; img.style.maxHeight = '100%';
        img.style.objectFit = 'contain'; img.style.borderRadius = '8px';
        img.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        canvasArea.appendChild(img);
        return img;
    }
    
    let currentActiveClip = null;

    window.addEventListener('timelineUpdate', (e) => {
        const time = e.detail.time;
        const isTimelinePlaying = window.isTimelinePlaying ? window.isTimelinePlaying() : false;
        const clips = document.querySelectorAll('.timeline-clip');
        let activeVideoClip = null;

        clips.forEach(clip => {
            const start = parseFloat(clip.dataset.startTime);
            const duration = parseFloat(clip.dataset.duration);
            
            if (clip.classList.contains('audio')) {
                const audio = clip.querySelector('audio');
                if (audio) {
                    const isWithinRange = time >= start && time < (start + duration);
                    if (isWithinRange) {
                        if (isTimelinePlaying) {
                            if (audio.paused) {
                                // Playhead entered audio range OR Play was pressed
                                audio.currentTime = time - start;
                                audio.play().catch(() => {});
                            } else {
                                // Only Force Sync if drift is HUGE (> 1.5s) to avoid glitched playback
                                const targetTime = time - start;
                                if (Math.abs(audio.currentTime - targetTime) > 1.5) {
                                    audio.currentTime = targetTime;
                                }
                            }
                        } else {
                            // SCRUBBING mode (Paused)
                            if (!audio.paused) audio.pause();
                            const targetTime = Math.max(0, Math.min(time - start, duration));
                            if (Math.abs(audio.currentTime - targetTime) > 0.1) {
                                audio.currentTime = targetTime;
                            }
                        }
                    } else {
                        // Out of range
                        if (!audio.paused) audio.pause();
                    }
                }
            }

            if (time >= start && time < (start + duration)) {
                if (clip.classList.contains('video')) activeVideoClip = clip;
            }
        });

        if (activeVideoClip) {
            const isNewClip = activeVideoClip !== currentActiveClip;
            const imgThumb = activeVideoClip.querySelector('img');
            if (imgThumb) {
                const previewImg = previewImage(imgThumb.src, isNewClip);
                if (window.applyFiltersToClip) window.applyFiltersToClip(activeVideoClip);
                if (isNewClip) {
                    currentActiveClip = activeVideoClip;
                    const anim = activeVideoClip.dataset.anim || 'none';
                    if (previewImg && anim !== 'none') {
                        previewImg.classList.remove('anim-fade', 'anim-slide', 'anim-zoom');
                        void previewImg.offsetWidth;
                        previewImg.classList.add(`anim-${anim}`);
                    }
                }
            }
        } else {
            currentActiveClip = null;
            const existingPreview = document.getElementById('active-preview');
            if (existingPreview) existingPreview.remove();
            if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
        }
    });

    document.addEventListener('click', (e) => {
        const clip = e.target.closest('.timeline-clip.video');
        if (clip) {
            const img = clip.querySelector('img');
            if (img) {
                const previewImg = previewImage(img.src, true);
                if (window.applyFiltersToClip) window.applyFiltersToClip(clip);
                const anim = clip.dataset.anim || 'none';
                if (previewImg && anim !== 'none') previewImg.classList.add(`anim-${anim}`);
            }
        }
    });
});
