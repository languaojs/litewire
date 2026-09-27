# Litewire Framework

```bash
npm i litewire
```

## Complete Architecture Manual & Reference Guide

A comprehensive technical breakdown of the HTML-driven AJAX engine, dynamic component loader, DOM swapping, state management, and lifecycle events.

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

**Litewire** is an HTML-first AJAX engine and dynamic component loader designed to build modern, interactive single-page-like applications with minimal client-side JavaScript configuration. By extending standard HTML elements with custom `lw-*` attributes, Litewire automatically intercepts user interactions, initiates asynchronous HTTP requests, updates specific DOM regions, and manages dynamic ES Module lifecycles.

> **Core Principles**  
> Litewire eliminates the need for full-page reloads and complex SPA frameworks by leveraging declarative markup, dynamic MutationObservers, and native browser features like `fetch()` and `history.pushState()`.

### Lifecycle Flow

1. **Initialization:** The class resolves the application's base URL and attaches DOM observers.
2. **Document Scanning:** Existing DOM nodes are scanned for request triggers and dynamic components.
3. **Event Binding:** Intercepts clicks, form submissions, and page load triggers automatically.
4. **Execution:** Sends non-blocking background HTTP requests with built-in CSRF security headers.
5. **Swap & Mount:** Replaces target DOM regions with backend HTML and automatically boots dynamic JS components on newly introduced elements.

---

## 2. Core Configuration & Initialization

Litewire auto-instantiates as soon as the DOM is ready, exposing its instance globally on `window.litewire`.

### Base URL Resolution Priority

To support deployment in deeply nested directories or custom app sub-paths, Litewire resolves its root URL using a four-tier fallback mechanism:

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
  baseUrl: "[https://api.myproject.com](https://api.myproject.com)",
  loadingClass: "is-loading", // Class applied to active triggers and indicators
});
```

---

## 3. Attribute Reference API

All core functionalities are driven by attaching `lw-*` attributes directly to standard HTML tags.

| Attribute      | Accepted Values                               | Default               | Functional Description                                                                                         |
| -------------- | --------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `lw-get`       | Relative / Absolute Path                      | None                  | Executes an HTTP GET request to the specified endpoint.                                                        |
| `lw-post`      | Relative / Absolute Path                      | None                  | Executes an HTTP POST request. Submits form payload if bound to or inside a `<form>`.                          |
| `lw-put`       | Relative / Absolute Path                      | None                  | Executes an HTTP PUT request with FormData payload attachment.                                                 |
| `lw-delete`    | Relative / Absolute Path                      | None                  | Executes an HTTP DELETE request.                                                                               |
| `lw-trigger`   | `click`, `submit`, `load`, custom             | Contextual            | Overrides trigger event. Defaults to `submit` for forms, `click` for interactive tags. `load` fires instantly. |
| `lw-target`    | CSS Selector                                  | Self Element          | Specifies the container element where the returned HTML response will be rendered.                             |
| `lw-swap`      | `innerHTML`, `outerHTML`, `prepend`, `append` | `innerHTML`           | Controls how the received HTML response replaces or integrates into the target element.                        |
| `lw-indicator` | CSS Selector                                  | `.litewire-indicator` | Specifies target loading elements. Automatically toggles the active `loadingClass` during request execution.   |
| `lw-push-url`  | `true`, `false`, Custom Path                  | `false`               | Pushes a new state to the browser history, caching DOM contents for native back/forward navigation.            |
| `lw-component` | JS File Path                                  | None                  | Asynchronously imports a JavaScript module and mounts it directly onto the host DOM element.                   |

---

## 4. Dynamic ES Module Loader (`lw-component`)

Litewire features a client-side component loader capable of fetching and initializing JavaScript ES modules on demand without requiring heavy bundle configurations or static page imports.

### Component Mounting Process

When an element with `lw-component="path/to/module.js"` is injected into the DOM:

1. Litewire resolves the full script path against `this.baseUrl`.
2. Executes a native dynamic `import(fullPath)` statement.
3. Extracts component constructors or functions via fallback export resolution:
   `module.default` → `module.imageUploader` → `Object.values(module)[0]`
4. Instantiates the module using `new componentFn(el, params)` or direct function execution.
5. Passes all `data-*` HTML attributes as an object to the component's `params` argument.

### Component Implementation Example

#### HTML Markup

```html
<!-- Target element containing component directives and dataset parameters -->
<div
  lw-component="assets/js/uploader.js"
  data-max-files="5"
  data-allowed-types="image/png,image/jpeg"
></div>
```

#### JavaScript Module (`assets/js/uploader.js`)

```javascript
export default class ImageUploader {
  constructor(element, params) {
    this.container = element;
    this.maxFiles = params.maxFiles || 1;
    this.allowedTypes = params.allowedTypes || "*";

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

Litewire supports multiple strategies for swapping returned server HTML responses into target elements using the `lw-swap` attribute.

### Swap Modes

- **`innerHTML` (Default):** Replaces the complete inner HTML content of the target container.
- **`outerHTML`:** Completely replaces the target element itself with the server response.
- **`prepend`:** Inserts the new server HTML snippet right before the first child inside the target element.
- **`append`:** Appends the new server HTML snippet right after the last child inside the target element.

### Automated Mutation Monitoring

Litewire uses an internal `MutationObserver` attached to `document.body`. Whenever new DOM elements are appended via AJAX swaps, standard page renders, or dynamic JS scripts, Litewire automatically scans and binds all newly discovered `lw-*` elements and mounts dynamic `lw-component` directives seamlessly.

---

## 6. History & State Caching

Enabling history tracking via `lw-push-url="true"` allows AJAX-driven applications to retain full browser history support, enabling smooth back-and-forward navigation without page refreshes.

### How State Caching Works

1. When a request completes successfully, Litewire captures the target container's current `innerHTML`.
2. Saves an object containing `{ litewireUrl, targetSelector, html }` into `window.history.state`.
3. When users press the browser's **Back** or **Forward** buttons, a `popstate` event fires.
4. Litewire retrieves the cached HTML snippet directly from history state and restores the DOM instantly without initiating network requests.
5. If no cached HTML state exists, Litewire seamlessly falls back to re-fetching the current location URL.

---

## 7. Event System & Lifecycle Hooks

Litewire dispatches standard, bubbling DOM events during the request lifecycles. Custom JavaScript code can hook into these lifecycle stages using standard `addEventListener` calls.

| Event Name               | `event.detail`     | Description / Usage                                                                                             |
| ------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `litewire:beforeRequest` | `null`             | Fires immediately before the HTTP request is initiated. Ideal for disabling inputs or custom client validation. |
| `litewire:afterRequest`  | `null`             | Fires after the request succeeds and the HTML content swap is complete. Ideal for triggering animations.        |
| `litewire:error`         | `{ error: Error }` | Fires if a network error occurs or the HTTP response returns an error status (non-2xx).                         |

### Lifecycle Hooks Example

```javascript
// Global logging and notification system integration
document.addEventListener("litewire:beforeRequest", (e) => {
  console.log("Initiating Litewire request from:", e.target);
});

document.addEventListener("litewire:error", (e) => {
  alert(`Request failed: ${e.detail.error.message}`);
});
```

---

## 8. CSRF & Security Protocols

Litewire natively secures outgoing write operations (`POST`, `PUT`, `DELETE`) against Cross-Site Request Forgery (CSRF) attacks.

### Automatic Token Attachment

Before dispatching non-GET requests, Litewire scans the host page head for a CSRF meta tag:

```html
<meta name="csrf-token" content="abc123securehash456" />
```

If detected, Litewire automatically includes the retrieved token into the HTTP request headers:

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
  lw-push-url="true"
/>

<table>
  <tbody id="user-table-body">
    <!-- Table rows updated dynamically -->
  </tbody>
</table>
```

```php
// Route
Route::get('/users/search', 'UsersController@search')->name('user.search');

//UserController
public function search(Request $request)
    {
        $query = $request->input('q', '');
        $search = $this->model('UsersModel')->searchUser($query);
        $data = [
            'users' => $search
        ];

        $html = $this->render('users/search', $data);
        return $this->response($html);
    }

//Blade
@if (!empty($users))
    @foreach ($users as $index => $user)
        <tr>
            <td>{{ $index + 1 }}</td>
            <td>{{ $user['fullname'] }}</td>
        </tr>
    @endforeach
@endif
```

### Pattern B: Form Submission with Indicator & Append Swap

```html
<form
  lw-post="/comments/add"
  lw-target="#comments-list"
  lw-swap="append"
  lw-indicator="#spinner"
>
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
<div
  lw-get="/analytics/widget"
  lw-trigger="load"
  lw-target="#analytics-container"
>
  <p>Loading real-time analytics data...</p>
</div>

<div id="analytics-container"></div>
```
