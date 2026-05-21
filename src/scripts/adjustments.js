document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const noClipMsg = document.getElementById('no-clip-message');
    const staticAdjustments = document.getElementById('static-adjustments');
    const colourAdjustments = document.getElementById('colour-adjustments');
    const deleteBtn = document.getElementById('delete-clip-btn');
    let selectedClip = null;
    
    function updatePanelVisibility() {
        if (selectedClip) {
            noClipMsg.style.display = 'none';
            const isVideo = selectedClip.classList.contains('video');
            const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
            
            // For audio, we only want to show the delete button part of static adjustments
            if (activeTab === 'static') {
                staticAdjustments.style.display = 'flex';
                colourAdjustments.style.display = 'none';
                
                // Hide video-specific groups if audio
                const groups = staticAdjustments.querySelectorAll('.adjustment-group');
                groups.forEach(g => {
                    if (g.contains(deleteBtn)) return;
                    g.style.display = isVideo ? 'flex' : 'none';
                });
            } else {
                staticAdjustments.style.display = 'none';
                colourAdjustments.style.display = isVideo ? 'flex' : 'none';
                if (!isVideo) noClipMsg.style.display = 'block'; // Or a message saying "Colour not available for audio"
            }
        } else {
            noClipMsg.style.display = 'block';
            staticAdjustments.style.display = 'none';
            colourAdjustments.style.display = 'none';
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updatePanelVisibility();
        });
    });

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (selectedClip) {
                const clipToRemove = selectedClip;
                selectedClip = null;
                clipToRemove.remove();
                if (window.updateTimelineUI) window.updateTimelineUI();
                updatePanelVisibility();
            }
        });
    }

    // Key listeners for delete
    window.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip) {
            // Check if focus isn't in an input/select
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            deleteBtn.click();
        }
    });

    const sliders = [
        { id: 'brightness', unit: '%' },
        { id: 'contrast', unit: '%' },
        { id: 'saturation', unit: '%' }
    ];

    sliders.forEach(sliderInfo => {
        const slider = document.getElementById(`${sliderInfo.id}-slider`);
        const display = document.getElementById(`${sliderInfo.id}-val`);
        if (slider && display) {
            slider.addEventListener('input', () => {
                display.textContent = `${slider.value}${sliderInfo.unit}`;
                if (selectedClip && selectedClip.classList.contains('video')) {
                    selectedClip.dataset[sliderInfo.id] = slider.value;
                    applyFiltersToClip(selectedClip);
                }
            });
        }
    });

    const filterSelect = document.getElementById('filter-select');
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            if (selectedClip && selectedClip.classList.contains('video')) {
                selectedClip.dataset.filter = filterSelect.value;
                applyFiltersToClip(selectedClip);
            }
        });
    }

    const durationInput = document.getElementById('duration-input');
    if (durationInput) {
        durationInput.addEventListener('input', () => {
            if (selectedClip && selectedClip.classList.contains('video')) {
                const val = parseFloat(durationInput.value);
                if (!isNaN(val) && val > 0) {
                    selectedClip.dataset.duration = val;
                    if (window.updateTimelineUI) window.updateTimelineUI();
                }
            }
        });
    }

    const animSelect = document.getElementById('anim-select');
    if (animSelect) {
        animSelect.addEventListener('change', () => {
            if (selectedClip && selectedClip.classList.contains('video')) {
                selectedClip.dataset.anim = animSelect.value;
            }
        });
    }

    function applyFiltersToClip(clip) {
        const preview = document.getElementById('active-preview');
        if (!preview || !clip.classList.contains('video')) return;
        const b = clip.dataset.brightness || 100;
        const c = clip.dataset.contrast || 100;
        const s = clip.dataset.saturation || 100;
        const f = clip.dataset.filter || 'none';
        let filterString = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
        if (f !== 'none') {
            switch(f) {
                case 'grayscale': filterString += ' grayscale(100%)'; break;
                case 'sepia': filterString += ' sepia(100%)'; break;
                case 'invert': filterString += ' invert(100%)'; break;
                case 'blur': filterString += ' blur(5px)'; break;
            }
        }
        preview.style.filter = filterString;
    }

    window.addEventListener('clipSelected', (e) => {
        selectedClip = e.detail.clip;
        if (selectedClip && selectedClip.classList.contains('video')) {
            document.getElementById('brightness-slider').value = selectedClip.dataset.brightness;
            document.getElementById('brightness-val').textContent = selectedClip.dataset.brightness + '%';
            document.getElementById('contrast-slider').value = selectedClip.dataset.contrast;
            document.getElementById('contrast-val').textContent = selectedClip.dataset.contrast + '%';
            document.getElementById('saturation-slider').value = selectedClip.dataset.saturation;
            document.getElementById('saturation-val').textContent = selectedClip.dataset.saturation + '%';
            document.getElementById('filter-select').value = selectedClip.dataset.filter;
            document.getElementById('duration-input').value = selectedClip.dataset.duration;
            document.getElementById('anim-select').value = selectedClip.dataset.anim;
            applyFiltersToClip(selectedClip);
        }
        updatePanelVisibility();
    });

    window.applyFiltersToClip = applyFiltersToClip;
    updatePanelVisibility();
});
