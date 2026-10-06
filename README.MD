# Litewire 1.0.3

Litewire is a small browser-side HTML-over-the-wire library. It binds HTTP
requests, reactive state, and event expressions to HTML attributes, swaps
server-rendered HTML into the page, and can load ES module components on
demand.

Version 1.0.3 adds reactive `lw:class` bindings, iterable lists with
`template[lw:for]`, and event-triggered component mounting. It also improves
radio model initialization and browser-history markup restoration.

## Contents

- [Install and start](#install-and-start)
- [End-to-end example](#end-to-end-example)
- [Configuration](#configuration)
- [AJAX requests](#ajax-requests)
- [Reactive state and bindings](#reactive-state-and-bindings)
- [Lists](#lists)
- [Dynamic components](#dynamic-components)
- [HTML swaps and DOM updates](#html-swaps-and-dom-updates)
- [Browser history](#browser-history)
- [Lifecycle events](#lifecycle-events)
- [CSRF](#csrf)
- [Troubleshooting](#troubleshooting)
- [Security considerations](#security-considerations)
- [API reference](#api-reference)

## Install and start

### Use the browser file

Download `litewire.js` and load it as an ES module:

```html
<script type="module" src="/js/litewire.js"></script>
```

Litewire creates `window.litewire` when the document is ready, unless that
global already exists. It scans the page, binds supported attributes, and
continues scanning elements added later.

### Use the npm package

Install version 1.0.3 from your configured npm registry:

```sh
npm install litewire@1.0.3
```

Import the package from your application's JavaScript entry point:

```js
import "litewire";
```

The package module auto-initializes in a browser environment. Do not create a
second instance unless you intentionally want an additional set of listeners
and observers.

### First request

```html
<button
  lw-get="/hello"
  lw-target="#result"
>
  Load greeting
</button>

<div id="result">The response will appear here.</div>
```

Litewire sends a GET request when the button is clicked and replaces the
contents of `#result` with the response HTML.

## End-to-end example

This example uses an HTML form to submit a search query and swaps the
server-rendered result into a separate element:

```html
<form
  lw-get="/search"
  lw-target="#search-results"
  lw-indicator="#search-status"
>
  <label>
    Search
    <input name="q" type="search" required>
  </label>
  <button type="submit">Search</button>
  <span id="search-status" aria-live="polite">Ready</span>
</form>

<section id="search-results" aria-live="polite">
  Enter a query to see results.
</section>
```

The browser sends a request like `GET /search?q=...`. The endpoint should
return an HTML fragment, for example:

```html
<h2>Results for “tea”</h2>
<ul>
  <li>Green tea</li>
  <li>Black tea</li>
</ul>
```

Litewire replaces the contents of `#search-results` with that fragment. The
new content is scanned for Litewire attributes and any `lw-component` modules
are loaded. No JSON decoding or client-side template rendering is performed.

## Configuration

Litewire resolves its base URL in this order:

1. `baseUrl` constructor option
2. `<meta name="base-url" content="...">`
3. `window.AppConfig.baseUrl`
4. `window.location.origin`

The default loading class is `litewire-request`. Configure these values before
Litewire auto-initializes by setting a meta tag or `window.AppConfig` before
loading the module:

```html
<meta name="base-url" content="https://example.com/app">
<script>
  window.AppConfig = { baseUrl: "https://example.com/app" };
</script>
<script type="module" src="/js/litewire.js"></script>
```

The constructor also accepts options when you instantiate the exported class
yourself:

```js
window.litewire = {};
const { default: Litewire } = await import("./litewire.js");

window.litewire = new Litewire({
  baseUrl: "https://example.com/app",
  loadingClass: "is-loading",
});
```

The placeholder prevents the module's browser auto-initializer from creating
another instance before your configured instance is constructed.

Request and component paths are joined to the resolved base URL. Leading
slashes are removed from the supplied path before joining.

## AJAX requests

Litewire recognizes `lw-get`, `lw-post`, `lw-put`, and `lw-delete`. It binds
forms to `submit` by default and other elements to `click`. Set `lw-trigger` to
choose a different event or to run a request when the element is scanned:

```html
<form lw-post="/messages" lw-target="#messages">
  <label>
    Message
    <input name="message" required>
  </label>
  <button type="submit">Send</button>
</form>

<div id="messages"></div>
```

For GET requests, form fields are encoded as URL query parameters. For POST,
PUT, and DELETE requests, a containing form is sent as `FormData`. If the
trigger is not in a form, no request body is added.

```html
<input
  name="q"
  lw-get="/search"
  lw-trigger="keyup"
  lw-target="#results"
  lw-indicator="#search-status"
>
<span id="search-status" class="litewire-indicator">Searching…</span>
<div id="results"></div>
```

When a request starts, Litewire adds the configured loading class to the
trigger and its indicators. Indicators default to `.litewire-indicator`
descendants of the trigger; `lw-indicator` can instead specify a document-wide
CSS selector. Litewire removes the class when the request finishes, whether it
succeeds or fails.

Use `lw-trigger="load"` with a request attribute to start a request as soon as
the element is scanned:

```html
<section
  lw-get="/account/summary"
  lw-trigger="load"
  lw-target="#account-summary"
>
  Loading account summary…
</section>
<div id="account-summary"></div>
```

### Request and form behavior

- A form listens for `submit` by default. Other elements listen for `click`.
  Set `lw-trigger` to a DOM event name to use another event; `load` runs the
  request immediately when the element is discovered.
- A GET request serializes all successful controls in the nearest containing
  form as URL query parameters. If there is no containing form, a control with
  a `name` and `value` contributes that one parameter.
- POST, PUT, and DELETE requests send the nearest containing form as
  `FormData`. If there is no form, Litewire sends no request body.
- Litewire checks `response.ok`; a non-success status is treated as a request
  failure. Successful response bodies are read as text and inserted as HTML.
  Set the response `Content-Type` appropriately on the server, even though
  Litewire does not parse it.
- `lw-target` is resolved with `document.querySelector`. If omitted, the
  triggering element is the target. Ensure the selector matches the intended
  element when the response is applied.
- A trigger and each loading indicator receive the configured loading class
  while the request is in flight. By default, indicators are descendants with
  the `litewire-indicator` class; `lw-indicator` can select indicators
  elsewhere in the document.
- Request failures are logged to the console and emit `litewire:error` from
  the trigger. The loading class is removed on both success and failure.

`lw-trigger="load"` is useful for initial content, but avoid putting it on
large numbers of elements if they would all issue requests at once.

## Reactive state and bindings

Litewire provides a small reactive layer using `lw:state`, `lw:model`,
`lw:text`, `lw:show`, `lw:class`, `lw:for`, and event-expression attributes.
The colon in these attribute names is intentional.

### Local state

Put `lw:state` on an element to create state for that element and its
descendants. Its value must be a JavaScript expression that evaluates to an
object:

```html
<section lw:state="{ count: 0, visible: true }">
  <button lw:click="count++">Count: <span lw:text="count"></span></button>
  <p lw:show="visible">This paragraph can be hidden.</p>
  <button lw:click="visible = !visible">Toggle paragraph</button>
</section>
```

Assignments and deletions of top-level state properties trigger rendering of
bindings on that element and its descendants that belong to that state root.
State is shallowly reactive:
mutating a nested object or array in place does not itself trigger a render.
Replace the top-level property to trigger one, for example
`settings = { ...settings, enabled: false }`.

Nested `lw:state` elements establish their own state scope. A binding uses the
nearest ancestor state root. Bindings outside a state root use Litewire's
global models instead.

### Text and visibility

- `lw:text="expression"` evaluates the expression and writes its result as
  text. `null` and `undefined` render as an empty string.
- `lw:show="expression"` sets the element's `hidden` property based on the
  truthiness of the result.
- `lw:class="{ className: expression }"` adds each class whose expression is
  truthy and removes classes previously managed by this binding when they
  become false. Other classes on the element are left alone; a key may contain
  multiple space-separated class names.

Expressions are evaluated when the element is first scanned and again when
their owning local state renders. Global model updates refresh matching
`lw:text` bindings and reevaluate global `lw:class` bindings and loops.

### Lists

Use `lw:for` on a `<template>` to repeat its contents for each value in an
iterable. The repeated expressions can access the item name and `$index`;
`(item, index)` also declares a named index:

```html
<ul lw:state="{ items: ['Apples', 'Pears'] }">
  <template lw:for="(item, index) of items">
    <li>
      <span lw:text="index + 1"></span>.
      <span lw:text="item"></span>
    </li>
  </template>
</ul>
```

The expression must evaluate to an iterable, such as an array, string, `Set`,
or `Map`; `null` and `undefined` render no rows. Assign a new array to the
top-level state property to refresh the list. Litewire recreates the repeated
DOM when the owning state renders; it does not key or preserve individual rows
across updates. `lw:for` also works with global models set through
`litewire.setModel()`.

### Form models

```html
<div lw:state="{ name: '' }">
  <label>
    Your name
    <input lw:model="name">
  </label>
  <p>Hello, <span lw:text="name"></span>.</p>
</div>
```

The default `lw:model` and `lw:model.live` listen for `input`.
`lw:model.change` listens for `change`, and `lw:model.blur` listens for `blur`.
For checkboxes, the model value is a boolean; for radio inputs, it is the
checked value or `null`. Unchecked radio buttons do not initialize or overwrite
the shared model; other controls use their value.

Without a local `lw:state` root, models are stored globally and can be read or
written with the instance methods `litewire.getModel(name)` and
`litewire.setModel(name, value)`. Global model changes dispatch a
`litewire:model` event on `document`, with `{ name, value }` in `event.detail`.

For example, a control outside a local state root can populate a global model,
and a matching text binding can display it:

```html
<input name="status" lw:model="status" aria-label="Status">
<p>Current status: <span lw:text="status"></span></p>

<script type="module">
  import "litewire";

  window.addEventListener("DOMContentLoaded", () => {
    window.litewire.setModel("status", "Ready");
  });
</script>
```

When setting global models from application code, set them on the initialized
`window.litewire` instance. `setModel()` updates a `lw:text` binding whose
expression is exactly that model name, reevaluates global `lw:class` and
`lw:for` bindings, and dispatches `litewire:model`.

A model name beginning with `#` or `.` is treated as a CSS selector instead of
a state key. Litewire copies the control's value to matching elements (to
`value` for form controls, otherwise to `textContent`) and dispatches
`litewire:model` on each target with `{ value }` in `event.detail`.

For example, `lw:model="#live-preview"` copies an input value to the
`textContent` of the element with that ID. Selector-based models update the
matching targets; they are not reactive state properties.

### Event expressions

Supported event attributes are:

```text
lw:click   lw:input   lw:change   lw:submit
lw:keydown lw:keyup   lw:focus    lw:blur
```

The attribute value is evaluated when its event fires. Within the expression,
the nearest local state properties (or global models) are in scope. Special
values are available:

- `$event`: the DOM event
- `$el`: the element carrying the directive
- `$value`: the current value of that element
- `$state`: the current state object
- `$wire`: the Litewire instance

```html
<div lw:state="{ query: '' }">
  <input lw:model="query">
  <button lw:click="console.log(query, $event)">Log query</button>
</div>
```

Supported event modifiers:

| Modifier | Behavior |
|---|---|
| `.prevent` | Calls `preventDefault()` |
| `.stop` | Calls `stopPropagation()` |
| `.once` | Runs the handler at most once |
| `.capture` | Registers the listener in capture phase |
| `.passive` | Registers a passive listener |
| `.self` | Runs only when the event target is the directive element |
| `.outside` | Runs only when the event target is outside the directive element |
| `.window` | Registers the listener on `window` |
| `.document` | Registers the listener on `document` |
| `.debounce` | Delays execution until events stop for 250 ms |
| `.throttle` | Runs at most once per 250 ms |

Modifiers can be combined, for example `lw:click.prevent.once="save()"`.
Debounce and throttle delays can be customized in milliseconds, for example
`lw:input.debounce.400ms="search()"` or
`lw:click.throttle.1000ms="refresh()"`. `.outside` listens at the document
level so it can observe events outside the element.

## Dynamic components

An element with `lw-component` dynamically imports a JavaScript module. The
path is joined to Litewire's base URL. Litewire selects the module's default
export first, then its first export. If the selected export is a function, it
is called with the host element and its `data-*` attributes converted to an
object:

```html
<div
  lw-component="components/greeting.js"
  data-user-name="Ada"
></div>
```

```js
// /app/components/greeting.js
export default class Greeting {
  constructor(element, params) {
    element.textContent = `Hello, ${params.userName}!`;
  }
}
```

New components inserted by a swap or added to the document are discovered
automatically. By default, and with `lw-trigger="load"`, a component mounts
when discovered. Set `lw-trigger` to another event name to defer mounting
until that event fires. On a triggered component, `lw-target` optionally
selects the element passed to the component constructor; the component path
and `data-*` parameters still come from the element carrying `lw-component`.
A component is mounted only once after a successful mount. To load one after
an event and mount it into another element, put `lw-trigger` and `lw-target`
on the component source:

```html
<button
  type="button"
  lw-component="components/widget.js"
  lw-trigger="click"
  lw-target="#widget"
  data-mode="compact"
>
  Load widget
</button>
<div id="widget"></div>
```

The module path and `data-*` parameters come from the element carrying
`lw-component`; `lw-target` is the element passed to the component.

## HTML swaps and DOM updates

Set `lw-target` to a CSS selector to choose where a response is inserted. If
omitted, the element that triggered the request is the target. `lw-swap`
controls how response HTML is applied:

| Value | Behavior |
|---|---|
| `innerHTML` (default) | Replaces the target's contents |
| `outerHTML` | Replaces the target element |
| `prepend` | Inserts response HTML at the beginning of the target |
| `append` | Inserts response HTML at the end of the target |

Litewire scans swapped content and mounts its components. It also observes
added DOM elements so directives in newly inserted content are bound
automatically.

## Browser history

Set `lw-push-url="true"` to push the request URL to browser history, or provide
a custom URL as the attribute value:

```html
<a
  href="/products"
  lw-get="/products"
  lw-target="#page"
  lw-push-url="true"
>
  Products
</a>
```

Litewire stores the URL, target selector, swap type, and target markup in
history state. When it creates the initial history entry, it saves the current
markup so Back can restore the prior view. For `outerHTML`, cached markup
includes the target element itself. When navigating with Back or Forward,
Litewire restores cached markup when the target still exists; otherwise it
attempts to fetch the stored URL. This caches only the selected target's
markup, not the complete document or JavaScript state.

## Lifecycle events

Litewire dispatches bubbling events from the request trigger:

| Event | `event.detail` | When it fires |
|---|---|---|
| `litewire:beforeRequest` | — | Immediately before sending a request |
| `litewire:afterRequest` | — | After a successful response has been swapped |
| `litewire:error` | `{ error }` | On a network failure or non-success HTTP response |

Reactive local state also dispatches `litewire:render` from its state root
after a render, with `{ state }` in `event.detail`.

```js
document.addEventListener("litewire:error", (event) => {
  console.error("Litewire request failed:", event.detail.error);
});

document.addEventListener("litewire:render", (event) => {
  console.log("State rendered:", event.detail.state);
});
```

## CSRF

When this meta tag is present, Litewire adds its token as the
`X-CSRF-TOKEN` header to outgoing requests:

```html
<meta name="csrf-token" content="your-server-generated-token">
```

The server must still validate the token and enforce its own authorization and
request protections.

## Troubleshooting

| Symptom | Things to check |
|---|---|
| The global `window.litewire` is missing | Load Litewire in a browser as a module and check the console for module loading errors. Auto-initialization occurs after the document is ready. |
| A request does not run | Confirm the element has one of `lw-get`, `lw-post`, `lw-put`, or `lw-delete`. Check its default or configured `lw-trigger` event and whether another handler prevents the event from reaching it. |
| The server receives no form values | Make sure the trigger is inside the form, or is the form itself. Non-GET requests without a containing form have no body. For GET, a standalone control needs both `name` and `value`. |
| The request succeeds but the page does not change | Return an HTML fragment, verify `lw-target` matches an element, and check that the selected `lw-swap` behavior is suitable. |
| A request reports an error | Inspect the browser console and the `litewire:error` event. Litewire treats HTTP statuses outside the 2xx range as failures. |
| A state binding stays unchanged | Confirm the binding is under the intended `lw:state` root. Replace a top-level state property; nested mutations are not observed. |
| A component does not mount | Check the module URL, its default or first export, and that the export is a function. For deferred components, verify the triggering event and optional `lw-target` selector. |
| A directive in newly inserted HTML does not run | Ensure the HTML is inserted through a Litewire swap or added to the observed document body. The observer watches additions under `document.body`. |

## Security considerations

Litewire inserts response bodies as HTML. Only return trusted or appropriately
sanitized HTML from your server.

`lw:state` and event-expression attributes are evaluated as JavaScript. Use
them only in markup you control; do not construct these expressions from
untrusted user input.

## API reference

| Attribute / API | Description |
|---|---|
| `lw-get`, `lw-post`, `lw-put`, `lw-delete` | Request path and HTTP method |
| `lw-trigger` | Request event (defaults to `click` or form `submit`; `load` runs on scan); for components, event to defer mounting |
| `lw-target` | CSS selector for the response target; for a triggered component, selects the element passed to the component |
| `lw-swap` | `innerHTML`, `outerHTML`, `prepend`, or `append` |
| `lw-indicator` | CSS selector for loading indicators |
| `lw-push-url` | `true`, `false`, or a custom history URL |
| `lw-component` | Path to a dynamically imported ES module; its default export or first export is mounted |
| `lw:state` | JavaScript object expression that initializes local reactive state |
| `lw:model`, `.live`, `.change`, `.blur` | Bind a form control to a state or global model |
| `lw:text` | Render an expression as text |
| `lw:show` | Toggle the element's `hidden` property from an expression |
| `lw:class` | Add or remove classes reactively from an object expression |
| `template[lw:for]` | Repeat template contents for an iterable expression; item and index variables are available to bindings |
| `lw:click`, `lw:input`, `lw:change`, `lw:submit`, `lw:keydown`, `lw:keyup`, `lw:focus`, `lw:blur` | Evaluate an expression in response to an event; supports the modifiers documented above |
| `litewire.getModel(name)` | Read a global model |
| `litewire.setModel(name, value)` | Set a global model and update matching bindings |
| `new Litewire({ baseUrl, loadingClass })` | Construct and initialize an instance with optional configuration |

The browser module exports the `Litewire` class as its default export and
auto-creates `window.litewire` if that global is not already set. When creating
a custom instance, set `window.litewire` to a placeholder before importing the
module if needed to prevent auto-initialization, then assign the instance.

**Buy my kids schoolbooks:** [https://paypal.me/justumg](https://paypal.me/justumg)