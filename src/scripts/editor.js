document.addEventListener('DOMContentLoaded', () => {
    const addMediaBtn = document.getElementById('add-media-btn');
    const mediaInput = document.getElementById('media-upload-input');
    const canvasArea = document.getElementById('canvas-area');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const exportBtn = document.querySelector('.btn-primary:last-child'); // Export button

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
        addMediaBtn.addEventListener('click', () => {
            const activeType = document.querySelector('.sidebar-item.active span').textContent.toLowerCase();
            if (activeType === 'text') {
                const text = prompt('Enter text for the timeline:');
                if (text && window.addClipToTimeline) {
                    window.addClipToTimeline(text, text.substring(0, 10) + '...', 'text');
                }
            } else {
                mediaInput.click();
            }
        });
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
        const existingText = document.getElementById('active-text-overlay');
        
        if (existingPreview) {
            if (!forceRecreate && existingPreview.src === src) return existingPreview;
            existingPreview.remove();
        }
        if (existingText) existingText.remove();
        
        const img = document.createElement('img');
        img.id = 'active-preview';
        img.src = src;
        img.style.maxWidth = '100%'; img.style.maxHeight = '100%';
        img.style.objectFit = 'contain'; img.style.borderRadius = '8px';
        img.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        canvasArea.appendChild(img);
        return img;
    }
    
    function showTextPreview(text) {
        if (previewPlaceholder) previewPlaceholder.style.display = 'none';
        const existingPreview = document.getElementById('active-preview');
        const existingText = document.getElementById('active-text-overlay');
        
        if (existingPreview) existingPreview.remove();
        if (existingText) {
            if (existingText.textContent === text) return existingText;
            existingText.remove();
        }

        const div = document.createElement('div');
        div.id = 'active-text-overlay';
        div.textContent = text;
        div.style.fontSize = '3rem';
        div.style.color = 'white';
        div.style.textShadow = '2px 2px 10px rgba(0,0,0,0.5)';
        div.style.fontWeight = 'bold';
        div.style.textAlign = 'center';
        canvasArea.appendChild(div);
        return div;
    }
    
    let currentActiveClip = null;

    window.addEventListener('timelineUpdate', (e) => {
        const time = e.detail.time;
        const isTimelinePlaying = window.isTimelinePlaying ? window.isTimelinePlaying() : false;
        const clips = document.querySelectorAll('.timeline-clip');
        let activeVideoClip = null;
        let activeTextClip = null;

        clips.forEach(clip => {
            const start = parseFloat(clip.dataset.startTime);
            const duration = parseFloat(clip.dataset.duration);
            const isWithinRange = time >= start && time < (start + duration);

            if (clip.classList.contains('audio')) {
                const audio = clip.querySelector('audio');
                if (audio) {
                    if (isWithinRange && isTimelinePlaying) {
                        if (audio.paused) {
                            audio.currentTime = time - start;
                            audio.play().catch(() => {});
                        } else {
                            const targetTime = time - start;
                            if (Math.abs(audio.currentTime - targetTime) > 1.5) audio.currentTime = targetTime;
                        }
                    } else {
                        if (!audio.paused) audio.pause();
                        if (!isTimelinePlaying) audio.currentTime = Math.max(0, Math.min(time - start, duration));
                    }
                }
            }

            if (isWithinRange) {
                if (clip.classList.contains('video')) activeVideoClip = clip;
                if (clip.classList.contains('text')) activeTextClip = clip;
            }
        });

        // Priority to Video, then Text
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
        } else if (activeTextClip) {
            showTextPreview(activeTextClip.dataset.text);
            currentActiveClip = activeTextClip;
        } else {
            currentActiveClip = null;
            const existingPreview = document.getElementById('active-preview');
            const existingText = document.getElementById('active-text-overlay');
            if (existingPreview) existingPreview.remove();
            if (existingText) existingText.remove();
            if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
        }
    });

    // Export Logic
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const clips = Array.from(document.querySelectorAll('.timeline-clip'));
            if (clips.length === 0) {
                alert('Add some clips to export.');
                return;
            }

            exportBtn.textContent = 'Exporting...';
            exportBtn.disabled = true;

            const canvas = document.createElement('canvas');
            canvas.width = 1280; canvas.height = 720; // Default HD
            const ctx = canvas.getContext('2d');
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            const chunks = [];

            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'exported-video.webm';
                a.click();
                exportBtn.textContent = 'Export';
                exportBtn.disabled = false;
            };

            recorder.start();

            // Total duration
            let totalDuration = 0;
            clips.forEach(c => {
                const end = parseFloat(c.dataset.startTime) + parseFloat(c.dataset.duration);
                if (end > totalDuration) totalDuration = end;
            });

            // Sequential rendering (Simplified simulation)
            const fps = 30;
            const frameTime = 1 / fps;
            
            for (let t = 0; t <= totalDuration; t += frameTime) {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Find active clips at time t
                const activeVideo = clips.find(c => c.classList.contains('video') && t >= parseFloat(c.dataset.startTime) && t < (parseFloat(c.dataset.startTime) + parseFloat(c.dataset.duration)));
                const activeText = clips.find(c => c.classList.contains('text') && t >= parseFloat(c.dataset.startTime) && t < (parseFloat(c.dataset.startTime) + parseFloat(c.dataset.duration)));

                if (activeVideo) {
                    const img = activeVideo.querySelector('img');
                    if (img && img.complete) {
                        // Apply filters
                        const b = activeVideo.dataset.brightness || 100;
                        const c = activeVideo.dataset.contrast || 100;
                        const s = activeVideo.dataset.saturation || 100;
                        ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
                        
                        // Scale to fit
                        const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
                        const w = img.naturalWidth * scale;
                        const h = img.naturalHeight * scale;
                        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                        ctx.filter = 'none';
                    }
                }

                if (activeText) {
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 60px Inter';
                    ctx.textAlign = 'center';
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 10;
                    ctx.fillText(activeText.dataset.text, canvas.width / 2, canvas.height / 2);
                    ctx.shadowBlur = 0;
                }

                // Wait for next frame
                await new Promise(r => setTimeout(r, 10));
            }

            recorder.stop();
        });
    }

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
