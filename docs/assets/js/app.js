(function (global) {
  const namespace = (global.MEFIT = global.MEFIT || {});
  const doc = global.document;

  const ensureHiddenForSignedInElements = () => {
    if (!doc) return;
    doc.querySelectorAll('[data-auth-visible="signed-in"]').forEach((element) => {
      if (element.hasAttribute('hidden')) return;
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    });
  };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', ensureHiddenForSignedInElements, { once: true });
  } else {
    ensureHiddenForSignedInElements();
  }

  /* =========================
     Utilidades básicas
     ========================= */
  const toStringSafe = (value) => (value ?? '').toString();
  const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

  const ready = (callback) => {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  };

  const createWarningLogger = () => {
    let shown = false;
    return (message, error) => {
      if (shown) return;
      shown = true;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(message, error);
      }
    };
  };

  const setElementVisibility = (element, shouldShow) => {
    if (!element) return;
    element.hidden = !shouldShow;
    if (!shouldShow) {
      element.setAttribute('aria-hidden', 'true');
    } else {
      element.removeAttribute('aria-hidden');
    }
  };

  const updateYear = () => {
    const targets = doc.querySelectorAll('#year, [data-current-year]');
    if (!targets.length) return;
    const currentYear = String(new Date().getFullYear());
    targets.forEach((element) => {
      element.textContent = currentYear;
    });
  };

  /* =========================
     Armazenamento seguro
     ========================= */
  const createStorage = (type, { fallback = false, onError } = {}) => {
    let storageRef = null;
    let supported = false;
    const memoryStore = fallback ? new Map() : null;

    const notifyError = (operation, error) => {
      if (typeof onError === 'function') {
        onError(operation, error);
      }
    };

    const ensureStorage = () => {
      if (storageRef) return storageRef;
      try {
        const candidate = global[type];
        if (!candidate) return null;
        const testKey = '__mefit_storage_test__';
        candidate.setItem(testKey, '1');
        candidate.removeItem(testKey);
        storageRef = candidate;
        supported = true;
      } catch (error) {
        storageRef = null;
        supported = false;
        notifyError('init', error);
      }
      return storageRef;
    };

    const get = (key) => {
      const storage = ensureStorage();
      if (storage && supported) {
        try {
          return storage.getItem(key);
        } catch (error) {
          storageRef = null;
          supported = false;
          notifyError('get', error);
        }
      }
      if (!memoryStore) return null;
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    };

    const set = (key, value) => {
      const storage = ensureStorage();
      if (storage && supported) {
        try {
          if (value === null || value === undefined) {
            storage.removeItem(key);
          } else {
            storage.setItem(key, value);
          }
          return true;
        } catch (error) {
          storageRef = null;
          supported = false;
          notifyError('set', error);
        }
      }
      if (!memoryStore) return false;
      if (value === null || value === undefined) {
        memoryStore.delete(key);
      } else {
        memoryStore.set(key, value);
      }
      return false;
    };

    const remove = (key) => {
      const storage = ensureStorage();
      if (storage && supported) {
        try {
          storage.removeItem(key);
          return true;
        } catch (error) {
          storageRef = null;
          supported = false;
          notifyError('remove', error);
        }
      }
      if (!memoryStore) return false;
      memoryStore.delete(key);
      return false;
    };

    return {
      get,
      set,
      remove,
      isSupported: () => supported
    };
  };

  const warnSessionAccess = createWarningLogger();
  const warnLocalStorage = createWarningLogger();

  const storage = {
    session: createStorage('sessionStorage', {
      onError: (_, error) => warnSessionAccess('Não foi possível acessar a sessão do cliente.', error)
    }),
    local: createStorage('localStorage', {
      onError: (_, error) => warnLocalStorage('Não foi possível acessar o armazenamento local.', error)
    })
  };

  /* =========================
     Carrinho compartilhado
     ========================= */
  const CART_KEY = 'mefit-cart-items';

  const normalizeId = (value) => toStringSafe(value);

  const coerceQuantity = (value, { min = 1, max = 99 } = {}) => {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) return min;
    const positive = Math.max(numeric, min);
    return Number.isFinite(max) ? Math.min(positive, max) : positive;
  };

  const cloneCartItems = (items) => (Array.isArray(items) ? items.map((item) => ({ ...item })) : []);

  const normalizeCartItem = (entry, { maxQuantity = 99 } = {}) => {
    if (entry == null) return null;

    if (typeof entry === 'string' || typeof entry === 'number') {
      const id = normalizeId(entry);
      return id ? { id, quantidade: 1 } : null;
    }

    if (typeof entry === 'object') {
      const id = normalizeId(entry.id ?? '');
      if (!id) return null;
      return {
        ...entry,
        id,
        quantidade: coerceQuantity(entry.quantidade, { min: 1, max: maxQuantity })
      };
    }

    return null;
  };

  const sanitizeCartItems = (items, options = {}) => {
    if (!Array.isArray(items) || !items.length) return [];
    const seen = new Set();
    const sanitized = [];

    items.forEach((entry) => {
      const normalized = normalizeCartItem(entry, options);
      if (!normalized || !normalized.id) return;
      if (seen.has(normalized.id)) return;
      seen.add(normalized.id);
      sanitized.push(normalized);
    });

    return sanitized;
  };

  const dispatchCartChange = (items, origin = 'app', { sanitized = false } = {}) => {
    const payload = sanitized ? cloneCartItems(items) : cloneCartItems(sanitizeCartItems(items));
    global.dispatchEvent(
      new CustomEvent('cart:changed', {
        detail: {
          origin,
          items: payload
        }
      })
    );
  };

  const loadCartItems = (options = {}) => {
    const stored = storage.local.get(CART_KEY);
    if (!stored) return [];

    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return sanitizeCartItems(parsed, options);
    } catch (error) {
      console.warn('Não foi possível ler o carrinho armazenado.', error);
      return [];
    }
  };

  const persistCartItems = (items, { dispatch = true, origin = 'app', maxQuantity } = {}) => {
    const sanitized = sanitizeCartItems(items, { maxQuantity });
    try {
      const serialized = JSON.stringify(sanitized);
      const persisted = storage.local.set(CART_KEY, serialized);
      if (!persisted) {
        console.warn('Não foi possível salvar o carrinho.');
      }
    } catch (error) {
      console.warn('Não foi possível salvar o carrinho.', error);
    }

    if (dispatch) {
      dispatchCartChange(sanitized, origin, { sanitized: true });
    }

    return sanitized;
  };

  const countCartItems = (items) =>
    Array.isArray(items)
      ? items.reduce((total, item) => total + (Number(item?.quantidade) || 1), 0)
      : 0;

  const cartModule = {
    STORAGE_KEY: CART_KEY,
    normalizeId,
    coerceQuantity,
    normalizeItem: normalizeCartItem,
    sanitizeItems: sanitizeCartItems,
    clone: cloneCartItems,
    load: loadCartItems,
    persist: persistCartItems,
    count: countCartItems,
    dispatchChange: (items, origin = 'app') => dispatchCartChange(items, origin)
  };

  /* =========================
     Autenticação (sessão)
     ========================= */
  const AUTH_SESSION_KEY = 'mefit-session-email';
  const AUTH_REMEMBER_KEY = 'mefit-remember-email';

  const dispatchAuthChange = (email) => {
    const normalized = trimString(email);
    doc.dispatchEvent(new CustomEvent('auth:changed', { detail: { email: normalized } }));
    return normalized;
  };

  const readSessionEmail = () => trimString(storage.session.get(AUTH_SESSION_KEY));

  const setSessionEmail = (email) => {
    const normalized = trimString(email);
    let persisted = false;

    if (normalized) {
      persisted = storage.session.set(AUTH_SESSION_KEY, normalized);
      if (!persisted) {
        storage.session.remove(AUTH_SESSION_KEY);
      }
    } else {
      storage.session.remove(AUTH_SESSION_KEY);
      persisted = true;
    }

    const finalEmail = persisted ? normalized : '';
    return { email: dispatchAuthChange(finalEmail), persisted };
  };

  const clearSessionEmail = () => {
    storage.session.remove(AUTH_SESSION_KEY);
    return { email: dispatchAuthChange(''), persisted: true };
  };

  // ——— versão consolidada (mantém melhorias)
  const isAuthenticated = () => Boolean(readSessionEmail());

  const logout = ({ redirect } = {}) => {
    const result = clearSessionEmail();
    const target = trimString(redirect);
    if (target) {
      global.location.href = target;
    }
    return result;
  };

  const readRememberedEmail = () => trimString(storage.local.get(AUTH_REMEMBER_KEY));

  const rememberEmail = (email) => {
    const normalized = trimString(email);
    if (!normalized) {
      storage.local.remove(AUTH_REMEMBER_KEY);
      return false;
    }
    return storage.local.set(AUTH_REMEMBER_KEY, normalized);
  };

  const clearRememberedEmail = () => {
    storage.local.remove(AUTH_REMEMBER_KEY);
  };

  const authModule = {
    readSessionEmail,
    isAuthenticated,
    setSessionEmail,
    clearSessionEmail,
    logout,
    dispatchChange: dispatchAuthChange,
    readRememberedEmail,
    rememberEmail,
    clearRememberedEmail,
    keys: {
      session: AUTH_SESSION_KEY,
      remember: AUTH_REMEMBER_KEY
    }
  };

  /* =========================
     Utilidades de UI
     ========================= */
  const ensureCartBadge = () => {
    let badge = doc.querySelector('[data-cart-count]');
    if (badge) return badge;

    const navLink = doc.querySelector('.nav a[href$="carrinho.html"]');
    if (!navLink) return null;

    badge = doc.createElement('span');
    badge.className = 'cart-count-badge';
    badge.dataset.cartCount = '';
    badge.hidden = true;
    badge.textContent = '0';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    badge.setAttribute('aria-label', 'Itens no carrinho');
    navLink.appendChild(badge);
    return badge;
  };

  const setupPageTransitions = () => {
    const body = doc.body;
    if (!body) return;

    const TRANSITION_MS = 350;
    let isNavigating = false;
    let pendingNavigation = null;

    const prefersReducedMotion =
      typeof global.matchMedia === 'function' ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const shouldAnimate = !(prefersReducedMotion && prefersReducedMotion.matches);

    body.classList.add('enable-page-transitions');
    if (shouldAnimate) {
      body.classList.add('is-page-entering');
      global.requestAnimationFrame(() => {
        body.classList.remove('is-page-entering');
      });
    }

    const finishEntering = () => {
      body.classList.remove('is-page-entering');
      body.classList.remove('is-page-leaving');
      isNavigating = false;
    };

    const isModifiedClick = (event) =>
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

    const isInternalLink = (link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return false;
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;

      const target = link.getAttribute('target');
      if (target && target.toLowerCase() !== '_self' && target !== '') return false;
      if (link.hasAttribute('download')) return false;

      const rel = link.getAttribute('rel');
      if (rel && rel.split(/\s+/).includes('external')) return false;

      try {
        const url = new URL(href, global.location.href);
        const current = new URL(global.location.href);
        if (url.origin !== current.origin) return false;

        const samePath = url.pathname === current.pathname && url.search === current.search;
        if (samePath && url.hash && url.hash !== current.hash) return false;
        if (url.href === current.href) return false;

        return true;
      } catch (error) {
        console.warn('Não foi possível interpretar o link para aplicar a transição.', error);
        return false;
      }
    };

    const navigateWithTransition = (url) => {
      if (isNavigating) return;
      isNavigating = true;
      if (shouldAnimate) {
        body.classList.add('is-page-leaving');
        pendingNavigation = global.setTimeout(() => {
          global.location.href = url;
        }, TRANSITION_MS);
      } else {
        global.location.href = url;
      }
    };

    doc.addEventListener('click', (event) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link || !isInternalLink(link)) return;

      event.preventDefault();
      navigateWithTransition(new URL(link.getAttribute('href'), global.location.href).href);
    });

    global.addEventListener('pageshow', (event) => {
      if (pendingNavigation) {
        global.clearTimeout(pendingNavigation);
        pendingNavigation = null;
      }
      if (event.persisted) {
        body.classList.add('enable-page-transitions');
      }
      finishEntering();
    });
  };

  const initCartBadge = () => {
    const updateCartBadge = (items) => {
      const badge = ensureCartBadge();
      if (!badge) return;
      const total = cartModule.count(items);
      badge.textContent = String(total);
      badge.hidden = total === 0;
    };

    const syncBadge = () => {
      updateCartBadge(cartModule.load());
    };

    syncBadge();

    global.addEventListener('storage', (event) => {
      if (event.key && event.key !== CART_KEY) return;
      syncBadge();
    });

    global.addEventListener('cart:changed', (event) => {
      const detailItems = event.detail?.items;
      if (Array.isArray(detailItems)) {
        updateCartBadge(cartModule.sanitizeItems(detailItems));
        return;
      }
      syncBadge();
    });
  };

  /* =========================
     Estado de Autenticação
     ========================= */
  const initAuthState = () => {
    const protectedAreas = Array.from(doc.querySelectorAll('[data-requires-auth]'));

    // Pré-oculta áreas protegidas até sincronizar o estado
    if (protectedAreas.length) {
      protectedAreas.forEach((area) => setElementVisibility(area, false));
    }

    const syncAuthVisibility = () => {
      const email = authModule.readSessionEmail();
      const isAuth = Boolean(email);

      if (protectedAreas.length) {
        protectedAreas.forEach((area) => setElementVisibility(area, isAuth));
      }

      doc
        .querySelectorAll('[data-auth-visible="signed-in"]')
        .forEach((el) => setElementVisibility(el, isAuth));

      doc
        .querySelectorAll('[data-auth-visible="signed-out"]')
        .forEach((el) => setElementVisibility(el, !isAuth));

      doc.querySelectorAll('[data-auth-email]').forEach((el) => {
        if (isAuth) {
          el.textContent = email;
          setElementVisibility(el, true);
        } else {
          el.textContent = '';
          setElementVisibility(el, false);
        }
      });

      if (!isAuth && protectedAreas.length) {
        const redirectTarget =
          protectedAreas[0].dataset.requiresAuth ||
          protectedAreas[0].dataset.authRedirect ||
          './login/';
        global.location.href = redirectTarget;
      }
    };

    doc.addEventListener('auth:changed', syncAuthVisibility);
    syncAuthVisibility();

    // Botões/links de logout
    doc.querySelectorAll('[data-logout]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        const redirect =
          el.getAttribute('data-logout-redirect') ||
          el.getAttribute('href');
        authModule.logout({
          redirect: redirect && redirect !== '#' ? redirect : undefined
        });
      });
    });
  };

  /* =========================
     Login (form demo)
     ========================= */
  const initLoginForm = () => {
    const loginForm = doc.querySelector('#login-form');
    if (!loginForm) return;

    const emailInput = loginForm.querySelector('input[name="email"]');
    const passwordInput = loginForm.querySelector('input[name="password"]');
    const rememberInput = loginForm.querySelector('input[name="remember"]');
    const feedbackEl = loginForm.querySelector('.form-feedback');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const toggleButton = loginForm.querySelector('[data-toggle-password]');

    const clearFeedback = () => {
      if (!feedbackEl) return;
      feedbackEl.hidden = true;
      feedbackEl.textContent = '';
      feedbackEl.classList.remove('is-error', 'is-success');
    };

    const showFeedback = (message, type = 'success') => {
      if (!feedbackEl) return;
      feedbackEl.textContent = message;
      feedbackEl.hidden = false;
      feedbackEl.classList.remove('is-error', 'is-success');
      feedbackEl.classList.add(type === 'error' ? 'is-error' : 'is-success');
    };

    const setLoading = (loading) => {
      if (!submitButton) return;
      if (loading) {
        if (!submitButton.dataset.originalText) {
          submitButton.dataset.originalText = submitButton.textContent ?? '';
        }
        submitButton.textContent = 'Entrando...';
      } else if (submitButton.dataset.originalText) {
        submitButton.textContent = submitButton.dataset.originalText;
      }
      submitButton.disabled = loading;
    };

    if (toggleButton && passwordInput) {
      toggleButton.addEventListener('click', () => {
        const shouldReveal = passwordInput.type === 'password';
        passwordInput.type = shouldReveal ? 'text' : 'password';
        toggleButton.textContent = shouldReveal ? 'Ocultar' : 'Mostrar';
        toggleButton.setAttribute('aria-pressed', shouldReveal ? 'true' : 'false');
        passwordInput.focus();
      });
    }

    const savedEmail = authModule.readRememberedEmail();
    if (savedEmail && emailInput) {
      emailInput.value = savedEmail;
      if (rememberInput) rememberInput.checked = true;
    }

    const sessionEmail = authModule.readSessionEmail();
    if (sessionEmail) {
      showFeedback(`Você está conectado como ${sessionEmail}.`, 'success');
    }

    loginForm.addEventListener('input', () => {
      if (feedbackEl?.classList.contains('is-error')) clearFeedback();
    });

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFeedback();

      if (!emailInput || !passwordInput) return;

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showFeedback('Informe seu e-mail e senha para continuar.', 'error');
        return;
      }

      if (password.length < 6) {
        showFeedback('A senha precisa ter pelo menos 6 caracteres.', 'error');
        return;
      }

      try {
        setLoading(true);
        const demoEmail = 'demo@mefit.com';
        const demoPassword = 'demo123';
        const isDemoLogin = email.toLowerCase() === demoEmail && password === demoPassword;

        if (!isDemoLogin) {
          showFeedback('Não encontramos uma conta com essas credenciais. Revise os dados digitados.', 'error');
          return;
        }

        const { persisted } = authModule.setSessionEmail(email);
        if (!persisted) {
          authModule.clearSessionEmail();
          showFeedback(
            'Não foi possível ativar a sessão porque o armazenamento do navegador está bloqueado. Libere cookies/armazenamento e tente novamente.',
            'error'
          );
          return;
        }

        if (rememberInput?.checked) authModule.rememberEmail(email);
        else authModule.clearRememberedEmail();

        showFeedback('Login realizado com sucesso! Em instantes você será redirecionado para a área do cliente.', 'success');
        global.setTimeout(() => {
          global.location.href = '../perfil-cliente.html';
        }, 1000);
      } catch (error) {
        console.error('Falha ao simular login:', error);
        showFeedback('Não foi possível conectar agora. Tente novamente em alguns instantes.', 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  /* =========================
     Boot
     ========================= */
  namespace.utils = {
    ready,
    trim: trimString,
    setElementVisibility,
    updateYear
  };
  namespace.storage = storage;
  namespace.cart = cartModule;
  namespace.auth = authModule;
  namespace.ui = {
    ensureCartBadge,
    updateYear,
    setElementVisibility
  };

  ready(() => {
    setupPageTransitions();
    updateYear();
    initAuthState();
    initLoginForm();
    initCartBadge();
  });
})(typeof window !== 'undefined' ? window : globalThis);
