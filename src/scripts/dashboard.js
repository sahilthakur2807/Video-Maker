document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const createProjectModal = document.getElementById('create-project-modal');
    const startEditingBtn = document.getElementById('start-editing-btn');
    const projectNameInput = document.getElementById('project-name');
    const aspectRatioSelect = document.getElementById('aspect-ratio');
    const projectGrid = document.getElementById('project-grid');
    const emptyState = document.getElementById('empty-state');

    // Persistence Logic
    const STORAGE_KEY = 'clipvid_projects';

    const getProjects = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    };

    const saveProject = (project) => {
        const projects = getProjects();
        projects.unshift(project);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    };

    const deleteProject = (id) => {
        const projects = getProjects().filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        renderProjects();
    };

    const renderProjects = () => {
        const projects = getProjects();
        
        // Clear existing cards
        const existingCards = projectGrid.querySelectorAll('.project-card');
        existingCards.forEach(c => c.remove());

        if (projects.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <div class="project-thumb">
                    <div class="thumb-placeholder">${project.ratio}</div>
                </div>
                <div class="project-info">
                    <h4>${project.name}</h4>
                    <p>Edited: ${new Date(project.createdAt).toLocaleDateString()}</p>
                    <div class="card-menu">
                        <button class="menu-trigger">⋮</button>
                        <div class="menu-dropdown">
                            <div class="menu-item delete">Delete Project</div>
                        </div>
                    </div>
                </div>
            `;

            // Card click (Go to editor)
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-menu')) return;
                const params = new URLSearchParams({
                    name: project.name,
                    ratio: project.ratio,
                    id: project.id
                });
                window.location.href = `editor.html?${params.toString()}`;
            });

            // Menu logic
            const trigger = card.querySelector('.menu-trigger');
            const dropdown = card.querySelector('.menu-dropdown');
            const deleteItem = card.querySelector('.menu-item.delete');

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other open dropdowns
                document.querySelectorAll('.menu-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.remove('active');
                });
                dropdown.classList.toggle('active');
            });

            deleteItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                    deleteProject(project.id);
                }
            });

            projectGrid.appendChild(card);
        });
    };

    // Close dropdowns on outside click
    window.addEventListener('click', () => {
        document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('active'));
    });

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

    if (openModalBtn) openModalBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
    
    if (createProjectModal) {
        createProjectModal.addEventListener('click', (e) => {
            if (e.target === createProjectModal) closeModal();
        });
    }

    if (startEditingBtn) {
        startEditingBtn.addEventListener('click', () => {
            const projectName = projectNameInput.value.trim();
            const aspectRatio = aspectRatioSelect.value;

            if (!projectName) {
                alert('Please enter a project name.');
                projectNameInput.focus();
                return;
            }

            const newProject = {
                id: Date.now().toString(),
                name: projectName,
                ratio: aspectRatio,
                createdAt: new Date().toISOString()
            };

            saveProject(newProject);
            const params = new URLSearchParams({
                name: newProject.name,
                ratio: newProject.ratio,
                id: newProject.id
            });
            window.location.href = `editor.html?${params.toString()}`;
        });
    }

    if (projectNameInput) {
        projectNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') startEditingBtn.click();
        });
    }

    renderProjects();
});
