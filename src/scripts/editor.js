document.addEventListener('DOMContentLoaded', () => {
    const addMediaBtn = document.getElementById('add-media-btn');
    const mediaInput = document.getElementById('media-upload-input');
    const canvasArea = document.getElementById('canvas-area');
    const previewPlaceholder = document.getElementById('preview-placeholder');

    // Handle project info from URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectName = urlParams.get('name');
    const aspectValue = urlParams.get('ratio');
    
    if (projectName) {
        document.getElementById('project-title-display').textContent = projectName;
    }
    if (aspectValue) {
        document.getElementById('aspect-ratio-display').textContent = `Aspect Ratio: ${aspectValue}`;
    }

    // Trigger file input
    if (addMediaBtn && mediaInput) {
        addMediaBtn.addEventListener('click', () => {
            mediaInput.click();
        });
    }

    // Handle file selection
    if (mediaInput) {
        mediaInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                files.forEach(file => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            if (window.addClipToTimeline) {
                                window.addClipToTimeline(event.target.result, file.name, 'video');
                            }
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        });
    }

    function previewImage(src) {
        // Hide placeholder
        if (previewPlaceholder) previewPlaceholder.style.display = 'none';
        
        // Remove existing preview
        const existingPreview = document.getElementById('active-preview');
        if (existingPreview) existingPreview.remove();
        
        // Create new preview
        const img = document.createElement('img');
        img.id = 'active-preview';
        img.src = src;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        
        canvasArea.appendChild(img);
    }
    
    // Listen for preview events from timeline clips (using event delegation)
    document.addEventListener('click', (e) => {
        const clip = e.target.closest('.timeline-clip');
        if (clip) {
            const img = clip.querySelector('img');
            if (img) {
                previewImage(img.src);
            }
        }
    });
});
