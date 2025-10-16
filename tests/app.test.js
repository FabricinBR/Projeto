import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appScript = fs.readFileSync(path.resolve(__dirname, '../docs/assets/js/app.js'), 'utf8');

const toPlainObject = (value) => JSON.parse(JSON.stringify(value));

class EventTargetMock {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(type, callback, options = {}) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push({ callback, once: Boolean(options?.once) });
  }

  removeEventListener(type, callback) {
    const listeners = this._listeners.get(type);
    if (!listeners) return;
    const index = listeners.findIndex((entry) => entry.callback === callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  dispatchEvent(event) {
    if (!event || typeof event.type !== 'string') {
      throw new TypeError('Eventos precisam ter um tipo.');
    }
    event.target = event.target || this;
    event.currentTarget = this;
    event.defaultPrevented = false;
    event.preventDefault = () => {
      event.defaultPrevented = true;
    };

    const listeners = this._listeners.get(event.type);
    if (!listeners) return !event.defaultPrevented;

    for (const entry of [...listeners]) {
      entry.callback.call(this, event);
      if (entry.once) {
        this.removeEventListener(event.type, entry.callback);
      }
    }

    return !event.defaultPrevented;
  }
}

class CustomEventMock {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

class StorageMock {
  constructor() {
    this._store = new Map();
  }

  get length() {
    return this._store.size;
  }

  key(index) {
    return [...this._store.keys()][index] ?? null;
  }

  getItem(key) {
    return this._store.has(key) ? this._store.get(key) : null;
  }

  setItem(key, value) {
    this._store.set(key, String(value));
  }

  removeItem(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }
}

const datasetKeyFromAttribute = (name) =>
  name
    .slice(5)
    .split('-')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');

class MockElement extends EventTargetMock {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.textContent = '';
    this.className = '';
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === 'id') {
      this.id = stringValue;
    }
    if (name.startsWith('data-')) {
      this.dataset[datasetKeyFromAttribute(name)] = stringValue;
    }
  }

  getAttribute(name) {
    if (name === 'id') {
      return this.id ?? null;
    }
    if (name.startsWith('data-')) {
      const key = datasetKeyFromAttribute(name);
      return this.dataset[key] ?? null;
    }
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    if (name === 'id') {
      return typeof this.id === 'string';
    }
    if (name.startsWith('data-')) {
      const key = datasetKeyFromAttribute(name);
      return Object.prototype.hasOwnProperty.call(this.dataset, key);
    }
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    if (name === 'id') {
      delete this.id;
    } else if (name.startsWith('data-')) {
      const key = datasetKeyFromAttribute(name);
      delete this.dataset[key];
    }
    this.attributes.delete(name);
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    if (this.ownerDocument && typeof this.ownerDocument._handleAppend === 'function') {
      this.ownerDocument._handleAppend(child);
    }
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) {
      this.parentNode.children.splice(index, 1);
    }
    this.parentNode = null;
  }
}

class DocumentMock extends EventTargetMock {
  constructor(windowRef) {
    super();
    this.defaultView = windowRef;
    this.readyState = 'loading';
    this.documentElement = new MockElement('html', this);
    this.body = new MockElement('body', this);
    this.documentElement.appendChild(this.body);
    this.nav = new MockElement('nav', this);
    this.nav.className = 'nav';
    this.navLink = new MockElement('a', this);
    this.navLink.setAttribute('href', './carrinho.html');
    this.nav.appendChild(this.navLink);
    this.body.appendChild(this.nav);
    this.yearElement = new MockElement('span', this);
    this.yearElement.setAttribute('id', 'year');
    this.body.appendChild(this.yearElement);
    this.cartBadge = null;
  }

  createElement(tagName) {
    return new MockElement(tagName, this);
  }

  querySelector(selector) {
    if (selector === '.nav a[href$="carrinho.html"]') {
      return this.navLink;
    }
    if (selector === '[data-cart-count]') {
      return this.cartBadge;
    }
    if (selector === '#year') {
      return this.yearElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '#year, [data-current-year]') {
      return this.yearElement ? [this.yearElement] : [];
    }
    return [];
  }

  _handleAppend(element) {
    if (element?.dataset && Object.prototype.hasOwnProperty.call(element.dataset, 'cartCount')) {
      this.cartBadge = element;
    }
  }
}

class WindowMock extends EventTargetMock {
  constructor() {
    super();
    this.location = { href: 'https://mefit.test/' };
    this.localStorage = new StorageMock();
    this.sessionStorage = new StorageMock();
    this.document = new DocumentMock(this);
    this.MEFIT = {};
    this.setTimeout = (...args) => globalThis.setTimeout(...args);
    this.clearTimeout = (...args) => globalThis.clearTimeout(...args);
    this.requestAnimationFrame = (callback) => this.setTimeout(() => callback(Date.now()), 0);
    this.cancelAnimationFrame = (id) => this.clearTimeout(id);
    this.matchMedia = () => ({ matches: false });
  }
}

const runAppScript = () => {
  const windowMock = new WindowMock();
  const context = {
    window: windowMock,
    document: windowMock.document,
    console,
    CustomEvent: CustomEventMock,
    setTimeout: windowMock.setTimeout,
    clearTimeout: windowMock.clearTimeout
  };
  context.globalThis = context;
  const script = new vm.Script(appScript);
  vm.createContext(context);
  script.runInContext(context);
  return windowMock;
};

test('cart.sanitizeItems remove entradas inválidas e aplica limites', () => {
  const windowMock = runAppScript();
  const { cart } = windowMock.MEFIT;
  const sanitized = cart.sanitizeItems(
    [
      { id: 'sku-1', quantidade: 2 },
      { id: 'sku-1', quantidade: 5 },
      { id: 'sku-2', quantidade: '3' },
      { id: '', quantidade: 4 },
      null,
      'sku-3'
    ],
    { maxQuantity: 4 }
  );

  assert.deepEqual(toPlainObject(sanitized), [
    { id: 'sku-1', quantidade: 2 },
    { id: 'sku-2', quantidade: 3 },
    { id: 'sku-3', quantidade: 1 }
  ]);
});

test('cart.persist salva no armazenamento e dispara evento de alteração', () => {
  const windowMock = runAppScript();
  const { cart } = windowMock.MEFIT;
  const events = [];
  windowMock.addEventListener('cart:changed', (event) => {
    events.push(event.detail);
  });

  const persisted = cart.persist(
    [
      { id: 'sku-1', quantidade: 1 },
      { id: 'sku-2', quantidade: 0 }
    ],
    { origin: 'test-suite' }
  );

  assert.deepEqual(toPlainObject(persisted), [
    { id: 'sku-1', quantidade: 1 },
    { id: 'sku-2', quantidade: 1 }
  ]);
  assert.equal(windowMock.localStorage.getItem(cart.STORAGE_KEY), JSON.stringify(persisted));
  assert.equal(events.length, 1);
  assert.equal(events[0].origin, 'test-suite');
  assert.deepEqual(toPlainObject(events[0].items), toPlainObject(persisted));
  assert.equal(cart.count(persisted), 2);
});

test('auth gerencia sessão, lembra e limpa e-mails', () => {
  const windowMock = runAppScript();
  const { auth } = windowMock.MEFIT;
  const events = [];
  windowMock.document.addEventListener('auth:changed', (event) => {
    events.push(event.detail.email);
  });

  const sessionResult = auth.setSessionEmail('usuario@example.com');
  assert.equal(sessionResult.persisted, true);
  assert.equal(auth.readSessionEmail(), 'usuario@example.com');
  assert.equal(
    windowMock.sessionStorage.getItem(auth.keys.session),
    'usuario@example.com'
  );

  assert.equal(auth.rememberEmail(' lembrete@example.com '), true);
  assert.equal(
    windowMock.localStorage.getItem(auth.keys.remember),
    'lembrete@example.com'
  );

  auth.clearRememberedEmail();
  assert.equal(windowMock.localStorage.getItem(auth.keys.remember), null);

  auth.clearSessionEmail();
  assert.equal(auth.readSessionEmail(), '');
  assert.deepEqual(events, ['usuario@example.com', '']);
});

test('ui.ensureCartBadge cria badge e utilitários atualizam a UI', () => {
  const windowMock = runAppScript();
  const { ui, utils } = windowMock.MEFIT;

  const badge = ui.ensureCartBadge();
  assert.ok(badge, 'badge deve ser criado');
  assert.equal(badge.dataset.cartCount, '');
  assert.equal(badge.hidden, true);

  utils.setElementVisibility(badge, false);
  assert.equal(badge.hidden, true);
  assert.equal(badge.getAttribute('aria-hidden'), 'true');

  utils.setElementVisibility(badge, true);
  assert.equal(badge.hidden, false);
  assert.equal(badge.getAttribute('aria-hidden'), null);

  const yearEl = windowMock.document.querySelector('#year');
  yearEl.textContent = '';
  utils.updateYear();
  assert.equal(yearEl.textContent, String(new Date().getFullYear()));
});
