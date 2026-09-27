class Litewire {
    constructor(options = {}) {
        const metaBaseUrl = document.querySelector('meta[name="base-url"]')?.getAttribute('content');
        const rawBaseUrl = options.baseUrl
            || metaBaseUrl
            || window.AppConfig?.baseUrl
            || window.location.origin;
        this.baseUrl = rawBaseUrl.replace(/\/+$/, '');
        this.loadingClass = options.loadingClass || 'litewire-request';
        this.init();
    }

    init() {
        this.scan(document);
        this.loadComponents(document);
        this.observe();
        this.listenToHistory();
    }

    async loadComponents(root) {
        const selector = '[lw-component]';
        const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];

        if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) {
            this.mountComponent(root);
        }
        elements.forEach(el => this.mountComponent(el));
    }

    async mountComponent(el) {
        if (el._litewireComponentMounted) return;
        el._litewireComponentMounted = true;

        const rawPath = el.getAttribute('lw-component');
        if (!rawPath) return;

        const cleanPath = rawPath.replace(/^\/+/, '');
        const fullPath = `${this.baseUrl}/${cleanPath}`;

        try {
            const module = await import(fullPath);
            const params = { ...el.dataset };

            const componentFn = module.default || module.imageUploader || Object.values(module)[0];

            if (typeof componentFn === 'function') {
                try {
                    new componentFn(el, params);
                } catch {
                    componentFn(el, params);
                }
            } else {
                console.error(`[Litewire Error] No valid export found in module: ${fullPath}`);
            }
        } catch (err) {
            console.error(`[Litewire Error] Failed to import component from ${fullPath}:`, err);
        }
    }

    scan(root) {
        const selector = '[lw-get], [lw-post], [lw-put], [lw-delete], [lw-trigger="load"]';
        const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];

        if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) {
            this.bindElement(root);
        }
        elements.forEach(el => this.bindElement(el));
    }

    bindElement(el) {
        if (el._litewireBound) return;
        el._litewireBound = true;

        const trigger = el.getAttribute('lw-trigger') || (el.tagName === 'FORM' ? 'submit' : 'click');

        if (trigger === 'load') {
            this.executeRequest(el);
        } else {
            el.addEventListener(trigger, (e) => {
                if (el.tagName === 'FORM' || trigger === 'click') e.preventDefault();
                this.executeRequest(el);
            });
        }
    }

    getIndicators(el) {
        const indicatorAttr = el.getAttribute('lw-indicator');
        if (!indicatorAttr) {
            return Array.from(el.querySelectorAll('.litewire-indicator'));
        }
        return Array.from(document.querySelectorAll(indicatorAttr));
    }

    async executeRequest(el, isPopState = false) {
        const method = ['post', 'put', 'delete', 'get'].find(m => el.hasAttribute(`lw-${m}`)) || 'get';
        const path = el.getAttribute(`lw-${method}`);
        if (!path) return;

        const cleanPath = path.replace(/^\/+/, '');
        let url = `${this.baseUrl}/${cleanPath}`;

        const options = { method: method.toUpperCase(), headers: {} };

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (csrfToken) {
            options.headers['X-CSRF-TOKEN'] = csrfToken;
        }

        if (method === 'get') {
            const form = el.tagName === 'FORM' ? el : el.closest('form');
            let params = new URLSearchParams();

            if (form) {
                params = new URLSearchParams(new FormData(form));
            } else if (el.name && el.value !== undefined) {
                params.append(el.name, el.value);
            }

            const queryString = params.toString();
            if (queryString) {
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        } else {
            const form = el.tagName === 'FORM' ? el : el.closest('form');
            if (form) {
                options.body = new FormData(form);
            }
        }

        const indicators = this.getIndicators(el);

        try {
            el.classList.add(this.loadingClass);
            indicators.forEach(ind => ind.classList.add(this.loadingClass));

            el.dispatchEvent(new CustomEvent('litewire:beforeRequest', { bubbles: true }));

            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();

            const target = this.swapHTML(el, html);

            if (!isPopState) {
                this.handleHistoryPush(el, url, target);
            }

            el.dispatchEvent(new CustomEvent('litewire:afterRequest', { bubbles: true }));
        } catch (err) {
            console.error(`[Litewire Error] ${method.toUpperCase()} ${url} failed:`, err);
            el.dispatchEvent(new CustomEvent('litewire:error', { bubbles: true, detail: { error: err } }));
        } finally {
            el.classList.remove(this.loadingClass);
            indicators.forEach(ind => ind.classList.remove(this.loadingClass));
        }
    }

    swapHTML(el, html) {
        const targetSelector = el.getAttribute('lw-target');
        const target = targetSelector ? document.querySelector(targetSelector) : el;
        const swapType = el.getAttribute('lw-swap') || 'innerHTML';

        if (!target) return target;

        if (swapType === 'outerHTML') {
            const parent = target.parentElement;
            target.outerHTML = html;
            if (parent) {
                this.scan(parent);
                this.loadComponents(parent);
            }
        } else if (swapType === 'prepend') {
            target.insertAdjacentHTML('afterbegin', html);
            this.scan(target);
            this.loadComponents(target);
        } else if (swapType === 'append') {
            target.insertAdjacentHTML('beforeend', html);
            this.scan(target);
            this.loadComponents(target);
        } else {
            target.innerHTML = html;
            this.scan(target);
            this.loadComponents(target);
        }

        return target;
    }

    handleHistoryPush(el, requestUrl, target) {
        const pushAttr = el.getAttribute('lw-push-url');
        if (!pushAttr || pushAttr === 'false') return;

        const newUrl = pushAttr === 'true' ? requestUrl : pushAttr;
        const targetSelector = el.getAttribute('lw-target') || '';

        if (!history.state) {
            history.replaceState({
                litewireUrl: window.location.href,
                targetSelector: targetSelector,
                html: target ? target.innerHTML : ''
            }, '', window.location.href);
        }

        history.pushState({
            litewireUrl: newUrl,
            targetSelector: targetSelector,
            html: target ? target.innerHTML : ''
        }, '', newUrl);
    }

    listenToHistory() {
        window.addEventListener('popstate', (e) => {
            if (!e.state) return;

            const { targetSelector, html, litewireUrl } = e.state;

            if (targetSelector && html !== undefined) {
                const target = document.querySelector(targetSelector);
                if (target) {
                    target.innerHTML = html;
                    this.scan(target);
                    this.loadComponents(target);
                    return;
                }
            }

            const fallbackEl = document.createElement('div');
            fallbackEl.setAttribute('lw-get', litewireUrl || window.location.href);
            if (targetSelector) fallbackEl.setAttribute('lw-target', targetSelector);

            this.executeRequest(fallbackEl, true);
        });
    }

    observe() {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.scan(node);
                        this.loadComponents(node);
                    }
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

export default Litewire;

// Auto-instantiate in browser environments if not loaded as a module
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.litewire) window.litewire = new Litewire();
        });
    } else {
        if (!window.litewire) window.litewire = new Litewire();
    }
}