# Litewire 1.0.2

Litewire is a browser-side HTML-over-the-wire library. It binds requests and
reactive behaviors to HTML attributes, swaps server-rendered HTML into the
page, and can load ES module components on demand.

## Contents

- [Install and start](#install-and-start)
- [Configuration](#configuration)
- [AJAX requests](#ajax-requests)
- [Reactive state and bindings](#reactive-state-and-bindings)
- [Dynamic components](#dynamic-components)
- [HTML swaps and DOM updates](#html-swaps-and-dom-updates)
- [Browser history](#browser-history)
- [Lifecycle events](#lifecycle-events)
- [CSRF](#csrf)
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

If version 1.0.2 is available from your configured npm registry:

```sh
npm install litewire@1.0.2
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

## Reactive state and bindings

Litewire 1.0.2 adds a small reactive layer using `lw:state`, `lw:model`,
`lw:text`, `lw:show`, and event-expression attributes. The colon in these
attribute names is intentional.

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
descendant `lw:text` and `lw:show` bindings owned by that state root. State is
shallowly reactive: mutating a nested object or array in place does not itself
trigger a render. Replace the top-level property to trigger one, for example
`settings = { ...settings, enabled: false }`.

Nested `lw:state` elements establish their own state scope. A binding uses the
nearest ancestor state root. Bindings outside a state root use Litewire's
global models instead.

### Text and visibility

- `lw:text="expression"` evaluates the expression and writes its result as
  text. `null` and `undefined` render as an empty string.
- `lw:show="expression"` sets the element's `hidden` property based on the
  truthiness of the result.

Expressions are evaluated when the element is first scanned and again when
their owning local state renders. Global model updates also update matching
`lw:text` bindings.

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
checked value or `null`; other controls use their value.

Without a local `lw:state` root, models are stored globally and can be read or
written with the instance methods `litewire.getModel(name)` and
`litewire.setModel(name, value)`. Global model changes dispatch a
`litewire:model` event on `document`, with `{ name, value }` in `event.detail`.

A model name beginning with `#` or `.` is treated as a CSS selector instead of
a state key. Litewire copies the control's value to matching elements (to
`value` for form controls, otherwise to `textContent`) and dispatches
`litewire:model` on each target with `{ value }` in `event.detail`.

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

## Dynamic components

An element with `lw-component` dynamically imports a JavaScript module. The
path is joined to Litewire's base URL. Litewire selects the module's default
export first, then a named `imageUploader` export, then the first export. If
the selected export is a function, it is called with the host element and its
`data-*` attributes converted to an object:

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
automatically. A given element is mounted only once.

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

Litewire stores the URL, target selector, and target HTML in history state.
When navigating with Back or Forward, it restores cached HTML when the state
contains a selector and markup and the target still exists. Otherwise it
attempts to fetch the stored URL. This caches only the selected target's HTML,
not the complete document or JavaScript state.

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
| `lw-trigger` | Event name; defaults to `click` or form `submit`; `load` runs immediately |
| `lw-target` | CSS selector for the response target |
| `lw-swap` | `innerHTML`, `outerHTML`, `prepend`, or `append` |
| `lw-indicator` | CSS selector for loading indicators |
| `lw-push-url` | `true`, `false`, or a custom history URL |
| `lw-component` | Path to a dynamically imported ES module |
| `lw:state` | JavaScript object expression that initializes local reactive state |
| `lw:model`, `.live`, `.change`, `.blur` | Bind a form control to a state or global model |
| `lw:text` | Render an expression as text |
| `lw:show` | Toggle the element's `hidden` property from an expression |
| `lw:click`, `lw:input`, `lw:change`, `lw:submit`, `lw:keydown`, `lw:keyup`, `lw:focus`, `lw:blur` | Evaluate an expression in response to an event; supports the modifiers documented above |
| `litewire.getModel(name)` | Read a global model |
| `litewire.setModel(name, value)` | Set a global model and update matching bindings |

**Buy my kids schoolbooks:** [https://paypal.me/justumg](https://paypal.me/justumg)