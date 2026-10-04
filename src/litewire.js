class Litewire {
  constructor(options = {}) {
    const metaBaseUrl = document
      .querySelector('meta[name="base-url"]')
      ?.getAttribute("content");
    const rawBaseUrl =
      options.baseUrl ||
      metaBaseUrl ||
      window.AppConfig?.baseUrl ||
      window.location.origin;
    this.baseUrl = rawBaseUrl.replace(/\/+$/, "");
    this.loadingClass = options.loadingClass || "litewire-request";
    this.models = {};
    this.init();
  }
  init() {
    this.scan(document);
    this.loadComponents(document);
    this.observe();
    this.listenToHistory();
  }
  async loadComponents(root) {
    const selector = "[lw-component]";
    const elements = root.querySelectorAll
      ? root.querySelectorAll(selector)
      : [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) {
      this.mountComponent(root);
    }
    elements.forEach((el) => this.mountComponent(el));
  }
  async mountComponent(el) {
    if (el._litewireComponentMounted) return;
    el._litewireComponentMounted = !0;
    const rawPath = el.getAttribute("lw-component");
    if (!rawPath) return;
    const cleanPath = rawPath.replace(/^\/+/, "");
    const fullPath = `${this.baseUrl}/${cleanPath}`;
    try {
      const module = await import(fullPath);
      const params = { ...el.dataset };
      const componentFn =
        module.default || module.imageUploader || Object.values(module)[0];
      if (typeof componentFn === "function") {
        try {
          new componentFn(el, params);
        } catch {
          componentFn(el, params);
        }
      } else {
        console.error(
          `[Litewire Error] No valid export found in module: ${fullPath}`,
        );
      }
    } catch (err) {
      console.error(
        `[Litewire Error] Failed to import component from ${fullPath}:`,
        err,
      );
    }
  }
  scan(root) {
    const requestSelector =
      '[lw-get], [lw-post], [lw-put], [lw-delete], [lw-trigger="load"]';
    const modelSelector = [
      "[lw\\:model]",
      "[lw\\:model\\.live]",
      "[lw\\:model\\.change]",
      "[lw\\:model\\.blur]",
    ].join(", ");
    const expressionSelector = [
      "[lw\\:click]",
      "[lw\\:input]",
      "[lw\\:change]",
      "[lw\\:submit]",
      "[lw\\:keydown]",
      "[lw\\:keyup]",
      "[lw\\:focus]",
      "[lw\\:blur]",
    ].join(", ");
    const stateSelector = "[lw\\:state]";
    const textSelector = "[lw\\:text]";
    const showSelector = "[lw\\:show]";
    const requestElements = root.querySelectorAll
      ? root.querySelectorAll(requestSelector)
      : [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(requestSelector)) {
      this.bindElement(root);
    }
    requestElements.forEach((el) => {
      this.bindElement(el);
    });
    const stateElements = root.querySelectorAll
      ? root.querySelectorAll(stateSelector)
      : [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(stateSelector)) {
      this.bindState(root);
    }
    stateElements.forEach((el) => {
      this.bindState(el);
    });
    const modelElements = root.querySelectorAll
      ? root.querySelectorAll(modelSelector)
      : [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(modelSelector)) {
      this.bindModel(root);
    }
    modelElements.forEach((el) => {
      this.bindModel(el);
    });
    const expressionElements = root.querySelectorAll
      ? root.querySelectorAll(expressionSelector)
      : [];
    if (
      root.nodeType === Node.ELEMENT_NODE &&
      root.matches(expressionSelector)
    ) {
      this.bindExpression(root);
    }
    expressionElements.forEach((el) => {
      this.bindExpression(el);
    });
    const textElements = root.querySelectorAll
      ? root.querySelectorAll(textSelector)
      : [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(textSelector)) {
      this.bindText(root);
    }
    textElements.forEach((el) => {
      this.bindText(el);
    });
    const showElements = root.querySelectorAll
      ? root.querySelectorAll(showSelector)
      : [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(showSelector)) {
      this.bindShow(root);
    }
    showElements.forEach((el) => {
      this.bindShow(el);
    });
  }
  bindElement(el) {
    if (el._litewireBound) return;
    el._litewireBound = !0;
    const trigger =
      el.getAttribute("lw-trigger") ||
      (el.tagName === "FORM" ? "submit" : "click");
    if (trigger === "load") {
      this.executeRequest(el);
      return;
    }
    el.addEventListener(trigger, (e) => {
      if (el.tagName === "FORM" || trigger === "click") {
        e.preventDefault();
      }
      this.executeRequest(el);
    });
  }
  bindState(el) {
    if (el._litewireStateBound) return;
    el._litewireStateBound = !0;
    const expression = el.getAttribute("lw:state");
    if (!expression) {
      el._litewireState = this.createReactiveState({}, el);
      return;
    }
    try {
      const initialState = this.evaluateState(expression);
      if (initialState === null || typeof initialState !== "object") {
        throw new Error("lw:state must evaluate to an object");
      }
      el._litewireState = this.createReactiveState(initialState, el);
      this.renderState(el);
    } catch (err) {
      console.error(
        "[Litewire Error] Failed to initialize lw:state:",
        expression,
        err,
      );
    }
  }
  evaluateState(expression) {
    return Function(`"use strict"; return (${expression});`)();
  }
  createReactiveState(initialState, root) {
    const litewire = this;
    return new Proxy(initialState, {
      set(target, property, value) {
        const result = Reflect.set(target, property, value);
        litewire.renderState(root);
        return result;
      },
      deleteProperty(target, property) {
        const result = Reflect.deleteProperty(target, property);
        litewire.renderState(root);
        return result;
      },
    });
  }
  getStateRoot(el) {
    let current = el;
    while (current && current !== document) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        if (current._litewireState) {
          return current;
        }
      }
      current = current.parentElement;
    }
    return null;
  }
  getState(el) {
    const root = this.getStateRoot(el);
    if (root) {
      return root._litewireState;
    }
    return this.models;
  }
  evaluateExpression(expression, el, event = null) {
    if (!expression) return undefined;
    const state = this.getState(el);
    const litewire = this;
    const scope = new Proxy(state, {
      has(target, property) {
        if (
          property === "$event" ||
          property === "$el" ||
          property === "$value" ||
          property === "$state" ||
          property === "$wire"
        ) {
          return !0;
        }
        return Reflect.has(target, property);
      },
      get(target, property, receiver) {
        if (property === "$event") {
          return event;
        }
        if (property === "$el") {
          return el;
        }
        if (property === "$value") {
          return litewire.getModelValue(el);
        }
        if (property === "$state") {
          return target;
        }
        if (property === "$wire") {
          return litewire;
        }
        return Reflect.get(target, property, receiver);
      },
      set(target, property, value, receiver) {
        return Reflect.set(target, property, value, receiver);
      },
      deleteProperty(target, property) {
        return Reflect.deleteProperty(target, property);
      },
    });
    try {
      return Function(
        "$scope",
        `
                    with ($scope) {
                        return (${expression});
                    }
                `,
      )(scope);
    } catch (err) {
      console.error(`[Litewire Expression Error] ${expression}`, err);
      return undefined;
    }
  }
  bindExpression(el) {
    if (el._litewireExpressionBound) return;
    el._litewireExpressionBound = !0;
    const attributes = Array.from(el.attributes);
    const expressionAttributes = attributes.filter((attr) =>
      attr.name.startsWith("lw:"),
    );
    expressionAttributes.forEach((attr) => {
      const rawName = attr.name;
      const parts = rawName.split(".");
      const directive = parts.shift();
      if (!directive.startsWith("lw:")) {
        return;
      }
      const eventName = directive.substring(3);
      const modifiers = parts;
      const expression = attr.value;
      if (!expression) return;
      this.bindExpressionEvent(el, eventName, expression, modifiers);
    });
  }
  bindExpressionEvent(el, eventName, expression, modifiers) {
    let target = el;
    if (modifiers.includes("window")) {
      target = window;
    }
    if (modifiers.includes("document")) {
      target = document;
    }
    let handler = (event) => {
      if (modifiers.includes("self") && event.target !== el) {
        return;
      }
      if (modifiers.includes("outside") && el.contains(event.target)) {
        return;
      }
      if (modifiers.includes("prevent")) {
        event.preventDefault();
      }
      if (modifiers.includes("stop")) {
        event.stopPropagation();
      }
      this.evaluateExpression(expression, el, event);
    };
    const debounceModifier = modifiers.find((modifier) =>
      modifier.startsWith("debounce"),
    );
    if (debounceModifier) {
      const match = debounceModifier.match(/^debounce(?:\.(\d+)ms)?$/);
      const delay = match?.[1] ? Number(match[1]) : 250;
      let timeout;
      const originalHandler = handler;
      handler = (event) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          originalHandler(event);
        }, delay);
      };
    }
    const throttleModifier = modifiers.find((modifier) =>
      modifier.startsWith("throttle"),
    );
    if (throttleModifier) {
      const match = throttleModifier.match(/^throttle(?:\.(\d+)ms)?$/);
      const delay = match?.[1] ? Number(match[1]) : 250;
      let lastRun = 0;
      const originalHandler = handler;
      handler = (event) => {
        const now = Date.now();
        if (now - lastRun < delay) {
          return;
        }
        lastRun = now;
        originalHandler(event);
      };
    }
    if (modifiers.includes("once")) {
      handler = this.once(handler);
    }
    const options = {
      capture: modifiers.includes("capture"),
      passive: modifiers.includes("passive"),
      once: !1,
    };
    target.addEventListener(eventName, handler, options);
  }
  once(handler) {
    let executed = !1;
    return (event) => {
      if (executed) return;
      executed = !0;
      handler(event);
    };
  }
  bindText(el) {
    if (el._litewireTextBound) return;
    el._litewireTextBound = !0;
    this.updateText(el);
  }
  updateText(el) {
    const expression = el.getAttribute("lw:text");
    if (!expression) return;
    const value = this.evaluateExpression(expression, el);
    el.textContent = value === null || value === undefined ? "" : String(value);
  }
  bindShow(el) {
    if (el._litewireShowBound) return;
    el._litewireShowBound = !0;
    this.updateShow(el);
  }
  updateShow(el) {
    const expression = el.getAttribute("lw:show");
    if (!expression) return;
    const value = this.evaluateExpression(expression, el);
    el.hidden = !Boolean(value);
  }
  renderState(root) {
    if (!root) return;
    const textElements = root.querySelectorAll
      ? root.querySelectorAll("[lw\\:text]")
      : [];
    const showElements = root.querySelectorAll
      ? root.querySelectorAll("[lw\\:show]")
      : [];
    textElements.forEach((el) => {
      if (this.getStateRoot(el) !== root) {
        return;
      }
      this.updateText(el);
    });
    showElements.forEach((el) => {
      if (this.getStateRoot(el) !== root) {
        return;
      }
      this.updateShow(el);
    });
    root.dispatchEvent(
      new CustomEvent("litewire:render", {
        bubbles: !0,
        detail: { state: root._litewireState },
      }),
    );
  }
  bindModel(el) {
    if (el._litewireModelBound) return;
    el._litewireModelBound = !0;
    const model =
      el.getAttribute("lw:model") ||
      el.getAttribute("lw:model.live") ||
      el.getAttribute("lw:model.change") ||
      el.getAttribute("lw:model.blur");
    if (!model) return;
    let event = "input";
    if (el.hasAttribute("lw:model.change")) {
      event = "change";
    }
    if (el.hasAttribute("lw:model.blur")) {
      event = "blur";
    }
    el.addEventListener(event, () => {
      const value = this.getModelValue(el);
      if (model.startsWith("#") || model.startsWith(".")) {
        this.updateModelTarget(model, value);
        return;
      }
      const stateRoot = this.getStateRoot(el);
      if (stateRoot) {
        stateRoot._litewireState[model] = value;
        return;
      }
      this.setModel(model, value);
    });
    const initialValue = this.getModelValue(el);
    if (model.startsWith("#") || model.startsWith(".")) {
      this.updateModelTarget(model, initialValue);
      return;
    }
    const stateRoot = this.getStateRoot(el);
    if (stateRoot) {
      if (
        !Object.prototype.hasOwnProperty.call(stateRoot._litewireState, model)
      ) {
        stateRoot._litewireState[model] = initialValue;
      }
      return;
    }
    this.setModel(model, initialValue);
  }
  getModelValue(el) {
    if (el.type === "checkbox") {
      return el.checked;
    }
    if (el.type === "radio") {
      return el.checked ? el.value : null;
    }
    return el.value ?? "";
  }
  updateModelTarget(selector, value) {
    const targets = document.querySelectorAll(selector);
    targets.forEach((target) => {
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        if (target.type === "checkbox") {
          target.checked = Boolean(value);
        } else {
          target.value = value ?? "";
        }
      } else {
        target.textContent = value ?? "";
      }
      target.dispatchEvent(
        new CustomEvent("litewire:model", { bubbles: !0, detail: { value } }),
      );
    });
  }
  setModel(name, value) {
    this.models[name] = value;
    this.updateModelText(name, value);
    document.dispatchEvent(
      new CustomEvent("litewire:model", {
        bubbles: !0,
        detail: { name, value },
      }),
    );
  }
  getModel(name) {
    return this.models[name];
  }
  updateModelText(name, value) {
    const elements = document.querySelectorAll(
      `[lw\\:text="${CSS.escape(name)}"]`,
    );
    elements.forEach((el) => {
      el.textContent = value ?? "";
    });
  }
  getIndicators(el) {
    const indicatorAttr = el.getAttribute("lw-indicator");
    if (!indicatorAttr) {
      return Array.from(el.querySelectorAll(".litewire-indicator"));
    }
    return Array.from(document.querySelectorAll(indicatorAttr));
  }
  async executeRequest(el, isPopState = !1) {
    const method =
      ["post", "put", "delete", "get"].find((m) =>
        el.hasAttribute(`lw-${m}`),
      ) || "get";
    const path = el.getAttribute(`lw-${method}`);
    if (!path) return;
    const cleanPath = path.replace(/^\/+/, "");
    let url = `${this.baseUrl}/${cleanPath}`;
    const options = { method: method.toUpperCase(), headers: {} };
    const csrfToken = document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute("content");
    if (csrfToken) {
      options.headers["X-CSRF-TOKEN"] = csrfToken;
    }
    if (method === "get") {
      const form = el.tagName === "FORM" ? el : el.closest("form");
      let params = new URLSearchParams();
      if (form) {
        params = new URLSearchParams(new FormData(form));
      } else if (el.name && el.value !== undefined) {
        params.append(el.name, el.value);
      }
      const queryString = params.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    } else {
      const form = el.tagName === "FORM" ? el : el.closest("form");
      if (form) {
        options.body = new FormData(form);
      }
    }
    const indicators = this.getIndicators(el);
    try {
      el.classList.add(this.loadingClass);
      indicators.forEach((ind) => {
        ind.classList.add(this.loadingClass);
      });
      el.dispatchEvent(
        new CustomEvent("litewire:beforeRequest", { bubbles: !0 }),
      );
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      const target = this.swapHTML(el, html);
      if (!isPopState) {
        this.handleHistoryPush(el, url, target);
      }
      el.dispatchEvent(
        new CustomEvent("litewire:afterRequest", { bubbles: !0 }),
      );
    } catch (err) {
      console.error(
        `[Litewire Error] ${method.toUpperCase()} ${url} failed:`,
        err,
      );
      el.dispatchEvent(
        new CustomEvent("litewire:error", {
          bubbles: !0,
          detail: { error: err },
        }),
      );
    } finally {
      el.classList.remove(this.loadingClass);
      indicators.forEach((ind) => {
        ind.classList.remove(this.loadingClass);
      });
    }
  }
  swapHTML(el, html) {
    const targetSelector = el.getAttribute("lw-target");
    const target = targetSelector ? document.querySelector(targetSelector) : el;
    const swapType = el.getAttribute("lw-swap") || "innerHTML";
    if (!target) return target;
    if (swapType === "outerHTML") {
      const parent = target.parentElement;
      target.outerHTML = html;
      if (parent) {
        this.scan(parent);
        this.loadComponents(parent);
      }
    } else if (swapType === "prepend") {
      target.insertAdjacentHTML("afterbegin", html);
      this.scan(target);
      this.loadComponents(target);
    } else if (swapType === "append") {
      target.insertAdjacentHTML("beforeend", html);
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
    const pushAttr = el.getAttribute("lw-push-url");
    if (!pushAttr || pushAttr === "false") {
      return;
    }
    const newUrl = pushAttr === "true" ? requestUrl : pushAttr;
    const targetSelector = el.getAttribute("lw-target") || "";
    if (!history.state) {
      history.replaceState(
        {
          litewireUrl: window.location.href,
          targetSelector,
          html: target ? target.innerHTML : "",
        },
        "",
        window.location.href,
      );
    }
    history.pushState(
      {
        litewireUrl: newUrl,
        targetSelector,
        html: target ? target.innerHTML : "",
      },
      "",
      newUrl,
    );
  }
  listenToHistory() {
    window.addEventListener("popstate", (e) => {
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
      const fallbackEl = document.createElement("div");
      fallbackEl.setAttribute("lw-get", litewireUrl || window.location.href);
      if (targetSelector) {
        fallbackEl.setAttribute("lw-target", targetSelector);
      }
      this.executeRequest(fallbackEl, !0);
    });
  }
  observe() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.scan(node);
            this.loadComponents(node);
          }
        });
      }
    });
    observer.observe(document.body, { childList: !0, subtree: !0 });
  }
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (!window.litewire) {
        window.litewire = new Litewire();
      }
    });
  } else {
    if (!window.litewire) {
      window.litewire = new Litewire();
    }
  }
}
export default Litewire;
