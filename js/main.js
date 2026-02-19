// Component Loader - Load header and footer dynamically
// Usage: Add data-component="header" or data-component="footer" to placeholder divs
// Also add data-base-path="../" to specify relative path depth
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
                // Replace {{BASE_PATH}} placeholder with actual base path
                html = html.replace(/\{\{BASE_PATH\}\}/g, basePath);
                placeholder.innerHTML = html;
                
                // Set active nav link based on current page
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const navLinks = placeholder.querySelectorAll('nav a');
                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href && href.includes(currentPage.replace('.html', ''))) {
                        link.classList.add('active');
                    }
                });
            })
            .catch(err => console.log('Component load error:', err));
    });
}

document.addEventListener('DOMContentLoaded', loadComponents);

document.addEventListener('DOMContentLoaded', function() {
    const tagFilters = document.querySelectorAll('.tag-filter .tag');
    const writeupItems = document.querySelectorAll('.writeup-item');
    
    let activeTag = null;
    
    tagFilters.forEach(tag => {
        tag.addEventListener('click', function() {
            const selectedTag = this.dataset.tag;
            
            if (activeTag === selectedTag) {
                this.classList.remove('active');
                activeTag = null;
                writeupItems.forEach(item => {
                    item.classList.remove('hidden');
                });
            } else {
                tagFilters.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                activeTag = selectedTag;
                
                writeupItems.forEach(item => {
                    const itemTags = item.dataset.tags ? item.dataset.tags.split(',') : [];
                    if (itemTags.includes(selectedTag)) {
                        item.classList.remove('hidden');
                    } else {
                        item.classList.add('hidden');
                    }
                });
            }
            
            updateSectionVisibility();
        });
    });
    
    function updateSectionVisibility() {
        const sections = document.querySelectorAll('.writeup-section');
        sections.forEach(section => {
            const visibleItems = section.querySelectorAll('.writeup-item:not(.hidden)');
            if (visibleItems.length === 0) {
                section.classList.add('hidden');
            } else {
                section.classList.remove('hidden');
            }
        });
    }
});

function parseMarkdown(markdown) {
    let html = markdown;
    
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
    
    html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
    
    html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    
    html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
    
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');
    
    html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2" alt="$1">');
    
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');
    
    html = html.replace(/\n/gim, '<br>');
    
    return html;
}
