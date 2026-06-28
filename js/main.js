// Component loader — injects header/footer marked with data-component,
// resolves {{BASE_PATH}}, and highlights the active nav item.
function loadComponents() {
    const components = document.querySelectorAll('[data-component]');

    components.forEach(placeholder => {
        const componentName = placeholder.dataset.component;
        const basePath = placeholder.dataset.basePath || '';
        const componentPath = basePath + 'components/' + componentName + '.html';

        fetch(componentPath)
            .then(response => {
                if (!response.ok) throw new Error('Component not found');
                return response.text();
            })
            .then(html => {
                html = html.replace(/\{\{BASE_PATH\}\}/g, basePath);
                placeholder.innerHTML = html;
                setActiveNav(placeholder);
            })
            .catch(err => console.log('Component load error:', err));
    });
}

// Mark the nav item that matches the current section (works for sub-pages too).
function setActiveNav(scope) {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const isHome = page === '' || page === 'index.html';

    scope.querySelectorAll('nav a').forEach(link => {
        const name = (link.getAttribute('href') || '').split('/').pop().replace('.html', '');
        const match = name === 'index'
            ? isHome
            : (path.indexOf('/' + name) !== -1 || page.indexOf(name) === 0);
        if (match) link.classList.add('active');
    });
}

// Thin reading-progress bar — article pages only.
function initReadingProgress() {
    if (!document.querySelector('article')) return;

    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    document.body.appendChild(bar);

    const update = () => {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - doc.clientHeight;
        const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
        bar.style.width = pct + '%';
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
}

// Tag filter for the posts list: chips carry data-tag, items carry data-tags.
function initTagFilter() {
    const chips = document.querySelectorAll('.tag-filter .chip');
    const items = document.querySelectorAll('.post-row-item');
    if (!chips.length) return;

    chips.forEach(chip => {
        chip.addEventListener('click', function () {
            const tag = this.dataset.tag;
            chips.forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            items.forEach(item => {
                const tags = item.dataset.tags ? item.dataset.tags.split(',') : [];
                const show = tag === 'all' || tags.indexOf(tag) !== -1;
                item.classList.toggle('hidden', !show);
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    loadComponents();
    initReadingProgress();
    initTagFilter();
});
