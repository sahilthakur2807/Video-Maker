document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const createProjectModal = document.getElementById('create-project-modal');
    const startEditingBtn = document.getElementById('start-editing-btn');
    const projectNameInput = document.getElementById('project-name');
    const aspectRatioSelect = document.getElementById('aspect-ratio');

    // Functions
    const openModal = () => {
        createProjectModal.classList.add('active');
        projectNameInput.focus();
    };

    const closeModal = () => {
        createProjectModal.classList.remove('active');
        projectNameInput.value = '';
        aspectRatioSelect.value = '16:9';
    };

    // Event Listeners
    if (openModalBtn) {
        openModalBtn.addEventListener('click', openModal);
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', closeModal);
    }

    if (createProjectModal) {
        createProjectModal.addEventListener('click', (e) => {
            if (e.target === createProjectModal) {
                closeModal();
            }
        });
    }

    // Handle project creation
    if (startEditingBtn) {
        startEditingBtn.addEventListener('click', () => {
            const projectName = projectNameInput.value.trim();
            const aspectRatio = aspectRatioSelect.value;

            if (!projectName) {
                alert('Please enter a project name.');
                projectNameInput.focus();
                return;
            }

            const params = new URLSearchParams({
                name: projectName,
                ratio: aspectRatio
            });
            
            window.location.href = `editor.html?${params.toString()}`;
        });
    }

    if (projectNameInput) {
        projectNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                startEditingBtn.click();
            }
        });
    }
});
