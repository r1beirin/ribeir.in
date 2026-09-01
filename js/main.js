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
                if (componentName === 'header') initSearch(basePath);
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

// ---------- site search (header) ----------
// Builds a small in-memory index by fetching the three list pages once, then
// filters posts + writeups by partial, per-token matching over
// title + tags + difficulty + excerpt. The data lives on the rows themselves
// (post rows and writeup rows both carry data-tags), so nothing extra to sync.
const SEARCH_CACHE_KEY = 'ribeirin-search-v1';
let searchIndex = null;
let searchIndexPromise = null;

function initSearch(basePath) {
    const input = document.getElementById('site-search');
    const panel = document.getElementById('search-results');
    const wrap = input && input.closest('.header-search');
    if (!input || !panel || !wrap || input.dataset.ready === '1') return;
    input.dataset.ready = '1';

    let activeIdx = -1;
    const labels = { post: 'post', htb: 'htb', hc: 'hc' };

    const render = (query) => {
        panel.textContent = '';
        activeIdx = -1;

        if (!query.trim()) { panel.classList.add('hidden'); return; }

        const results = runSearch(query).slice(0, 12);
        if (!results.length) {
            const empty = document.createElement('div');
            empty.className = 'search-empty';
            empty.textContent = 'no matches';
            panel.appendChild(empty);
            panel.classList.remove('hidden');
            return;
        }

        results.forEach((entry) => {
            const a = document.createElement('a');
            a.className = 'search-result';
            a.setAttribute('role', 'option');
            a.href = basePath + entry.url;

            const head = document.createElement('div');
            head.className = 'sr-head';

            const badge = document.createElement('span');
            badge.className = 'sr-badge ' + entry.type;
            badge.textContent = labels[entry.type] || entry.type;
            head.appendChild(badge);

            const title = document.createElement('span');
            title.className = 'sr-title';
            title.textContent = entry.title;
            head.appendChild(title);
            a.appendChild(head);

            if (entry.tags) {
                const tags = document.createElement('div');
                tags.className = 'sr-tags';
                tags.textContent = entry.tags.split(',').join(' · ');
                a.appendChild(tags);
            }
            panel.appendChild(a);
        });
        panel.classList.remove('hidden');
    };

    const setActive = (next) => {
        const items = panel.querySelectorAll('.search-result');
        if (!items.length) return;
        if (items[activeIdx]) items[activeIdx].classList.remove('active');
        activeIdx = (next + items.length) % items.length;
        items[activeIdx].classList.add('active');
        items[activeIdx].scrollIntoView({ block: 'nearest' });
    };

    input.addEventListener('input', () => {
        const q = input.value;
        buildSearchIndex(basePath).then(() => render(q));
    });
    input.addEventListener('focus', () => {
        buildSearchIndex(basePath).then(() => { if (input.value.trim()) render(input.value); });
    });
    input.addEventListener('keydown', (e) => {
        const items = panel.querySelectorAll('.search-result');
        if (e.key === 'Escape') {
            input.value = '';
            panel.textContent = '';
            panel.classList.add('hidden');
            input.blur();
        } else if (e.key === 'ArrowDown' && items.length) {
            e.preventDefault();
            setActive(activeIdx + 1);
        } else if (e.key === 'ArrowUp' && items.length) {
            e.preventDefault();
            setActive(activeIdx - 1);
        } else if (e.key === 'Enter') {
            const target = items[activeIdx] || items[0];
            if (target) { e.preventDefault(); window.location.href = target.href; }
        }
    });

    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) panel.classList.add('hidden');
    });
}

// Fetch + parse the three list pages once; cache the raw index for the session.
function buildSearchIndex(basePath) {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (searchIndexPromise) return searchIndexPromise;

    try {
        const cached = sessionStorage.getItem(SEARCH_CACHE_KEY);
        if (cached) {
            searchIndex = prepareIndex(JSON.parse(cached));
            return Promise.resolve(searchIndex);
        }
    } catch (e) { /* storage unavailable — fall through to fetch */ }

    const sources = [
        { url: 'posts.html', type: 'post' },
        { url: 'writeups/hackthebox.html', type: 'htb' },
        { url: 'writeups/hackingclub.html', type: 'hc' }
    ];

    searchIndexPromise = Promise.all(sources.map((src) =>
        fetch(basePath + src.url)
            .then((r) => (r.ok ? r.text() : ''))
            .then((html) => parseSource(html, src.type))
            .catch(() => [])
    )).then((groups) => {
        const flat = groups.reduce((all, g) => all.concat(g), []);
        try { sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(flat)); } catch (e) { /* ignore */ }
        searchIndex = prepareIndex(flat);
        return searchIndex;
    });
    return searchIndexPromise;
}

function parseSource(html, type) {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const txt = (el) => (el ? el.textContent.trim() : '');
    const out = [];

    if (type === 'post') {
        doc.querySelectorAll('.post-row-item').forEach((li) => {
            const link = li.querySelector('a.post-row');
            if (!link) return;
            out.push({
                type: 'post',
                title: txt(li.querySelector('.row-title')),
                url: link.getAttribute('href') || '',
                tags: li.getAttribute('data-tags') || '',
                date: txt(li.querySelector('.row-meta .date')),
                difficulty: '',
                excerpt: txt(li.querySelector('.row-excerpt'))
            });
        });
    } else {
        doc.querySelectorAll('.machine-row').forEach((li) => {
            const link = li.querySelector('a.machine-name');
            if (!link) return;
            out.push({
                type: type,
                title: txt(link),
                url: 'writeups/' + (link.getAttribute('href') || ''),
                tags: li.getAttribute('data-tags') || '',
                date: txt(li.querySelector('.machine-date')),
                difficulty: txt(li.querySelector('.diff')),
                excerpt: txt(li.querySelector('.machine-desc'))
            });
        });
    }
    return out;
}

function prepareIndex(entries) {
    entries.forEach((e) => {
        e.titleTags = (e.title + ' ' + e.tags).toLowerCase();
        e.haystack = (e.titleTags + ' ' + e.difficulty + ' ' + e.excerpt).toLowerCase();
    });
    return entries;
}

// Partial + per-token: every whitespace-separated token must be a substring of
// the entry (so "camaleon", "camaleon cms" and "cve-2025-2304" all match).
function runSearch(query) {
    if (!searchIndex) return [];
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];

    return searchIndex
        .filter((e) => tokens.every((t) => e.haystack.indexOf(t) !== -1))
        .map((e) => ({ e, s: tokens.reduce((s, t) => s + (e.titleTags.indexOf(t) !== -1 ? 2 : 1), 0) }))
        .sort((a, b) => (b.s - a.s) || (b.e.date || '').localeCompare(a.e.date || ''))
        .map((x) => x.e);
}

document.addEventListener('DOMContentLoaded', function () {
    loadComponents();
    initReadingProgress();
    initTagFilter();
});
