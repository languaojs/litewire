# Litewire Framework

## Complete Architecture Manual & Reference Guide

A comprehensive technical breakdown of the HTML-driven AJAX engine, dynamic component loader, DOM swapping, state management, and lifecycle events[cite: 1].

---

## Table of Contents

1. [Architecture Overview & Lifecycle](#1-architecture-overview--lifecycle)
2. [Core Configuration & Initialization](#2-core-configuration--initialization)
3. [Attribute Reference API](#3-attribute-reference-api)
4. [Dynamic ES Module Loader (`lw-component`)](#4-dynamic-es-module-loader-lw-component)
5. [DOM Swapping & Navigation Mechanisms](#5-dom-swapping--navigation-mechanisms)
6. [History & State Caching](#6-history--state-caching)
7. [Event System & Lifecycle Hooks](#7-event-system--lifecycle-hooks)
8. [CSRF & Security Protocols](#8-csrf--security-protocols)
9. [Practical Implementation Patterns](#9-practical-implementation-patterns)

---

## 1. Architecture Overview & Lifecycle

**Litewire** is an HTML-first AJAX engine and dynamic component loader designed to build modern, interactive single-page-like applications with minimal client-side JavaScript configuration[cite: 1]. By extending standard HTML elements with custom `lw-*` attributes, Litewire automatically intercepts user interactions, initiates asynchronous HTTP requests, updates specific DOM regions, and manages dynamic ES Module lifecycles[cite: 1].

> **Core Principles**  
> Litewire eliminates the need for full-page reloads and complex SPA frameworks by leveraging declarative markup, dynamic MutationObservers, and native browser features like `fetch()` and `history.pushState()`[cite: 1].

### Lifecycle Flow

1. **Initialization:** The class resolves the application's base URL and attaches DOM observers[cite: 1].
2. **Document Scanning:** Existing DOM nodes are scanned for request triggers and dynamic components[cite: 1].
3. **Event Binding:** Intercepts clicks, form submissions, and page load triggers automatically[cite: 1].
4. **Execution:** Sends non-blocking background HTTP requests with built-in CSRF security headers[cite: 1].
5. **Swap & Mount:** Replaces target DOM regions with backend HTML and automatically boots dynamic JS components on newly introduced elements[cite: 1].

---

## 2. Core Configuration & Initialization

Litewire auto-instantiates as soon as the DOM is ready, exposing its instance globally on `window.litewire`[cite: 1].

### Base URL Resolution Priority

To support deployment in deeply nested directories or custom app sub-paths, Litewire resolves its root URL using a four-tier fallback mechanism[cite: 1]:

```text
1. Constructor Option:  new Litewire({ baseUrl: '[https://example.com/api](https://example.com/api)' })
2. Meta Tag Element:    <meta name="base-url" content="[https://example.com](https://example.com)">
3. Global App Config:  window.AppConfig.baseUrl
4. Window Location:     window.location.origin (Default)
```

### Instantiation Example

```javascript
// Custom manual instantiation with options
const customLitewire = new Litewire({
    baseUrl: '[https://api.myproject.com](https://api.myproject.com)',
    loadingClass: 'is-loading' // Class applied to active triggers and indicators
});
```

---

## 3. Attribute Reference API

All core functionalities are driven by attaching `lw-*` attributes directly to standard HTML tags[cite: 1].

| Attribute | Accepted Values | Default | Functional Description |
|---|---|---|---|
| `lw-get` | Relative / Absolute Path | None | Executes an HTTP GET request to the specified endpoint[cite: 1]. |
| `lw-post` | Relative / Absolute Path | None | Executes an HTTP POST request. Submits form payload if bound to or inside a `<form>`[cite: 1]. |
| `lw-put` | Relative / Absolute Path | None | Executes an HTTP PUT request with FormData payload attachment[cite: 1]. |
| `lw-delete` | Relative / Absolute Path | None | Executes an HTTP DELETE request[cite: 1]. |
| `lw-trigger` | `click`, `submit`, `load`, custom | Contextual | Overrides trigger event. Defaults to `submit` for forms, `click` for interactive tags. `load` fires instantly[cite: 1]. |
| `lw-target` | CSS Selector | Self Element | Specifies the container element where the returned HTML response will be rendered[cite: 1]. |
| `lw-swap` | `innerHTML`, `outerHTML`, `prepend`, `append` | `innerHTML` | Controls how the received HTML response replaces or integrates into the target element[cite: 1]. |
| `lw-indicator` | CSS Selector | `.litewire-indicator` | Specifies target loading elements. Automatically toggles the active `loadingClass` during request execution[cite: 1]. |
| `lw-push-url` | `true`, `false`, Custom Path | `false` | Pushes a new state to the browser history, caching DOM contents for native back/forward navigation[cite: 1]. |
| `lw-component` | JS File Path | None | Asynchronously imports a JavaScript module and mounts it directly onto the host DOM element[cite: 1]. |

---

## 4. Dynamic ES Module Loader (`lw-component`)

Litewire features a client-side component loader capable of fetching and initializing JavaScript ES modules on demand without requiring heavy bundle configurations or static page imports[cite: 1].

### Component Mounting Process

When an element with `lw-component="path/to/module.js"` is injected into the DOM[cite: 1]:

1. Litewire resolves the full script path against `this.baseUrl`[cite: 1].
2. Executes a native dynamic `import(fullPath)` statement[cite: 1].
3. Extracts component constructors or functions via fallback export resolution[cite: 1]:
   `module.default` → `module.imageUploader` → `Object.values(module)[0]`[cite: 1]
4. Instantiates the module using `new componentFn(el, params)` or direct function execution[cite: 1].
5. Passes all `data-*` HTML attributes as an object to the component's `params` argument[cite: 1].

### Component Implementation Example

#### HTML Markup

```html
<!-- Target element containing component directives and dataset parameters -->
<div 
  lw-component="assets/js/uploader.js" 
  data-max-files="5" 
  data-allowed-types="image/png,image/jpeg">
</div>
```

#### JavaScript Module (`assets/js/uploader.js`)

```javascript
export default class ImageUploader {
    constructor(element, params) {
        this.container = element;
        this.maxFiles = params.maxFiles || 1;
        this.allowedTypes = params.allowedTypes || '*';
        
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="upload-box">
                <p>Upload up to ${this.maxFiles} files (${this.allowedTypes})</p>
                <input type="file" multiple accept="${this.allowedTypes}">
            </div>
        `;
    }
}
```

---

## 5. DOM Swapping & Navigation Mechanisms

Litewire supports multiple strategies for swapping returned server HTML responses into target elements using the `lw-swap` attribute[cite: 1].

### Swap Modes

- **`innerHTML` (Default):** Replaces the complete inner HTML content of the target container[cite: 1].
- **`outerHTML`:** Completely replaces the target element itself with the server response[cite: 1].
- **`prepend`:** Inserts the new server HTML snippet right before the first child inside the target element[cite: 1].
- **`append`:** Appends the new server HTML snippet right after the last child inside the target element[cite: 1].

### Automated Mutation Monitoring

Litewire uses an internal `MutationObserver` attached to `document.body`[cite: 1]. Whenever new DOM elements are appended via AJAX swaps, standard page renders, or dynamic JS scripts, Litewire automatically scans and binds all newly discovered `lw-*` elements and mounts dynamic `lw-component` directives seamlessly[cite: 1].

---

## 6. History & State Caching

Enabling history tracking via `lw-push-url="true"` allows AJAX-driven applications to retain full browser history support, enabling smooth back-and-forward navigation without page refreshes[cite: 1].

### How State Caching Works

1. When a request completes successfully, Litewire captures the target container's current `innerHTML`[cite: 1].
2. Saves an object containing `{ litewireUrl, targetSelector, html }` into `window.history.state`[cite: 1].
3. When users press the browser's **Back** or **Forward** buttons, a `popstate` event fires[cite: 1].
4. Litewire retrieves the cached HTML snippet directly from history state and restores the DOM instantly without initiating network requests[cite: 1].
5. If no cached HTML state exists, Litewire seamlessly falls back to re-fetching the current location URL[cite: 1].

---

## 7. Event System & Lifecycle Hooks

Litewire dispatches standard, bubbling DOM events during the request lifecycles[cite: 1]. Custom JavaScript code can hook into these lifecycle stages using standard `addEventListener` calls[cite: 1].

| Event Name | `event.detail` | Description / Usage |
|---|---|---|
| `litewire:beforeRequest` | `null` | Fires immediately before the HTTP request is initiated. Ideal for disabling inputs or custom client validation[cite: 1]. |
| `litewire:afterRequest` | `null` | Fires after the request succeeds and the HTML content swap is complete. Ideal for triggering animations[cite: 1]. |
| `litewire:error` | `{ error: Error }` | Fires if a network error occurs or the HTTP response returns an error status (non-2xx)[cite: 1]. |

### Lifecycle Hooks Example

```javascript
// Global logging and notification system integration
document.addEventListener('litewire:beforeRequest', (e) => {
    console.log('Initiating Litewire request from:', e.target);
});

document.addEventListener('litewire:error', (e) => {
    alert(`Request failed: ${e.detail.error.message}`);
});
```

---

## 8. CSRF & Security Protocols

Litewire natively secures outgoing write operations (`POST`, `PUT`, `DELETE`) against Cross-Site Request Forgery (CSRF) attacks[cite: 1].

### Automatic Token Attachment

Before dispatching non-GET requests, Litewire scans the host page head for a CSRF meta tag[cite: 1]:

```html
<meta name="csrf-token" content="abc123securehash456">
```

If detected, Litewire automatically includes the retrieved token into the HTTP request headers[cite: 1]:

```text
X-CSRF-TOKEN: abc123securehash456
```

---

## 9. Practical Implementation Patterns

### Pattern A: Instant Dynamic Search Table

```html
<!-- Live search input updating target table and browser address bar -->
<input 
  type="text" 
  name="q" 
  placeholder="Search users..." 
  lw-get="/users/search" 
  lw-trigger="keyup" 
  lw-target="#user-table-body" 
  lw-push-url="true">

<table>
  <tbody id="user-table-body">
    <!-- Table rows updated dynamically -->
  </tbody>
</table>
```

### Pattern B: Form Submission with Indicator & Append Swap

```html
<form lw-post="/comments/add" lw-target="#comments-list" lw-swap="append" lw-indicator="#spinner">
  <textarea name="comment" required placeholder="Write a comment..."></textarea>
  
  <button type="submit">
    Post Comment 
    <span id="spinner" class="litewire-indicator hidden">Posting...</span>
  </button>
</form>

<div id="comments-list">
  <!-- New comments prepended or appended dynamically -->
</div>
```

### Pattern C: Lazy-Loading Section on Page Load

```html
<!-- Automatically fetches and replaces content once page loads -->
<div lw-get="/analytics/widget" lw-trigger="load" lw-target="#analytics-container">
    <p>Loading real-time analytics data...</p>
</div>

<div id="analytics-container"></div>
```