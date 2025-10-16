const ready = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
};

/* =========================
   Autenticação (sessão)
   ========================= */
const AUTH_SESSION_KEY = 'mefit-session-email';
const AUTH_REMEMBER_KEY = 'mefit-remember-email';

let sessionWarningShown = false;
let memorySessionEmail = '';
let sessionPersisted = false;

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim() : '');

const warnSessionAccess = (message, error) => {
  if (sessionWarningShown) return;
  sessionWarningShown = true;
  console.warn(message, error);
};

const readSessionEmail = () => {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) {
    return sessionPersisted ? memorySessionEmail : '';
  }

  try {
    const value = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    const normalized = normalizeEmail(value);
    memorySessionEmail = normalized;
    sessionPersisted = true;
    return normalized;
  } catch (error) {
    warnSessionAccess('Não foi possível acessar a sessão do cliente.', error);
    return sessionPersisted ? memorySessionEmail : '';
  }
};

const writeSessionEmail = (email) => {
  const normalized = normalizeEmail(email);
  memorySessionEmail = normalized;
  sessionPersisted = false;

  if (typeof window === 'undefined' || !('sessionStorage' in window)) {
    return { email: normalized, persisted: false };
  }

  try {
    if (!normalized) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(AUTH_SESSION_KEY, normalized);
    }
    sessionPersisted = true;
    return { email: normalized, persisted: true };
  } catch (error) {
    warnSessionAccess('Não foi possível atualizar a sessão do cliente.', error);
    return { email: normalized, persisted: false };
  }
};

const dispatchAuthChange = (overrideEmail) => {
  const email =
    typeof overrideEmail === 'string' ? normalizeEmail(overrideEmail) : readSessionEmail();
  document.dispatchEvent(new CustomEvent('auth:changed', { detail: { email } }));
  return email;
};

const setSessionEmail = (email) => {
  const result = writeSessionEmail(email);
  if (!result.persisted) {
    // se não persistiu em sessionStorage, não mantemos fallback (exigir habilitar armazenamento)
    memorySessionEmail = '';
  }
  const finalEmail = result.persisted ? result.email : '';
  return { email: dispatchAuthChange(finalEmail), persisted: result.persisted };
};

const clearSessionEmail = () => {
  const result = writeSessionEmail('');
  return { email: dispatchAuthChange(''), persisted: result.persisted };
};

/* =========================
   Carrinho - badge
   ========================= */
const ensureCartBadge = () => {
  let badge = document.querySelector('[data-cart-count]');
  if (badge) return badge;

  const navLink = document.querySelector('.nav a[href$="carrinho.html"]');
  if (!navLink) return null;

  badge = document.createElement('span');
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

const CART_KEY = 'mefit-cart-items';

const normalizeId = (value) => (value ?? '').toString();

const coerceQuantity = (value) => {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const normalizeStoredItem = (entry) => {
  if (entry == null) return null;

  if (typeof entry === 'string' || typeof entry === 'number') {
    const id = normalizeId(entry);
    return id ? { id, quantidade: 1 } : null;
  }

  if (typeof entry === 'object') {
    const id = 'id' in entry ? normalizeId(entry.id) : '';
    if (!id) return null;
    return { ...entry, id, quantidade: coerceQuantity(entry.quantidade) };
  }

  return null;
};

const loadCartItems = () => {
  if (typeof window === 'undefined' || !('localStorage' in window)) return [];
  try {
    const stored = window.localStorage.getItem(CART_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    return parsed
      .map(normalizeStoredItem)
      .filter((item) => {
        if (!item?.id) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  } catch (error) {
    console.warn('Não foi possível ler o carrinho armazenado.', error);
    return [];
  }
};

const updateCartBadge = (items) => {
  const badge = ensureCartBadge();
  if (!badge) return;

  const total = Array.isArray(items)
    ? items.reduce((sum, item) => sum + (Number(item?.quantidade) || 1), 0)
    : 0;
  badge.textContent = String(total);
  badge.hidden = total === 0;
};

const initCartBadge = () => {
  const syncBadge = () => {
    const items = loadCartItems();
    updateCartBadge(items);
  };

  syncBadge();

  window.addEventListener('storage', (event) => {
    if (event.key && event.key !== CART_KEY) return;
    syncBadge();
  });

  window.addEventListener('cart:changed', (event) => {
    const detailItems = event.detail?.items;
    if (Array.isArray(detailItems)) {
      updateCartBadge(detailItems.map(normalizeStoredItem).filter(Boolean));
      return;
    }
    syncBadge();
  });
};

/* =========================
   Utilidades de UI
   ========================= */
const updateYear = () => {
  const targets = document.querySelectorAll('#year, [data-current-year]');
  if (!targets.length) return;

  const currentYear = String(new Date().getFullYear());
  targets.forEach((element) => {
    element.textContent = currentYear;
  });
};

const setElementVisibility = (element, shouldShow) => {
  element.hidden = !shouldShow;
  if (!shouldShow) {
    element.setAttribute('aria-hidden', 'true');
  } else {
    element.removeAttribute('aria-hidden');
  }
};

const setupPageTransitions = () => {
  const { body } = document;
  if (!body) return;

  const TRANSITION_MS = 350;
  let isNavigating = false;
  let pendingNavigation = null;

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const shouldAnimate = !(prefersReducedMotion && prefersReducedMotion.matches);

  body.classList.add('enable-page-transitions');
  if (shouldAnimate) {
    body.classList.add('is-page-entering');
    window.requestAnimationFrame(() => {
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
      const url = new URL(href, window.location.href);
      const current = new URL(window.location.href);
      if (url.origin !== current.origin) return false;

      const samePath = url.pathname === current.pathname && url.search === current.search;
      if (samePath && (url.hash && url.hash !== current.hash)) return false;
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
      pendingNavigation = window.setTimeout(() => {
        window.location.href = url;
      }, TRANSITION_MS);
    } else {
      window.location.href = url;
    }
  };

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || isModifiedClick(event)) return;

    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || !isInternalLink(link)) return;

    event.preventDefault();
    navigateWithTransition(new URL(link.getAttribute('href'), window.location.href).href);
  });

  window.addEventListener('pageshow', (event) => {
    if (pendingNavigation) {
      window.clearTimeout(pendingNavigation);
      pendingNavigation = null;
    }
    if (event.persisted) {
      body.classList.add('enable-page-transitions');
    }
    finishEntering();
  });
};

/* =========================
   Estado de Autenticação
   ========================= */
const initAuthState = () => {
  const protectedAreas = Array.from(document.querySelectorAll('[data-requires-auth]'));

  const syncAuthVisibility = () => {
    const email = readSessionEmail();
    const isAuthenticated = Boolean(email);

    document
      .querySelectorAll('[data-auth-visible="signed-in"]')
      .forEach((el) => setElementVisibility(el, isAuthenticated));

    document
      .querySelectorAll('[data-auth-visible="signed-out"]')
      .forEach((el) => setElementVisibility(el, !isAuthenticated));

    document.querySelectorAll('[data-auth-email]').forEach((el) => {
      if (isAuthenticated) {
        el.textContent = email;
        setElementVisibility(el, true);
      } else {
        el.textContent = '';
        setElementVisibility(el, false);
      }
    });

    if (!isAuthenticated && protectedAreas.length) {
      const redirectTarget =
        protectedAreas[0].dataset.requiresAuth ||
        protectedAreas[0].dataset.authRedirect ||
        './login/';
      window.location.href = redirectTarget;
    }
  };

  document.addEventListener('auth:changed', syncAuthVisibility);
  syncAuthVisibility();

  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      clearSessionEmail();
      const redirect = el.getAttribute('data-logout-redirect');
      if (redirect) window.location.href = redirect;
    });
  });
};

/* =========================
   Login (form demo)
   ========================= */
const initLoginForm = () => {
  const loginForm = document.querySelector('#login-form');
  if (!loginForm) return;

  const emailInput = loginForm.querySelector('input[name="email"]');
  const passwordInput = loginForm.querySelector('input[name="password"]');
  const rememberInput = loginForm.querySelector('input[name="remember"]');
  const feedbackEl = loginForm.querySelector('.form-feedback');
  const submitButton = loginForm.querySelector('button[type="submit"]');
  const toggleButton = loginForm.querySelector('[data-toggle-password]');

  const REMEMBER_KEY = AUTH_REMEMBER_KEY;

  const getRememberedEmail = () => {
    try {
      return localStorage.getItem(REMEMBER_KEY) ?? '';
    } catch (error) {
      console.warn('Não foi possível carregar preferências de login salvas.', error);
      return '';
    }
  };

  const setRememberedEmail = (email) => {
    try {
      if (email) localStorage.setItem(REMEMBER_KEY, email);
    } catch (error) {
      console.warn('Não foi possível salvar preferências de login.', error);
    }
  };

  const clearRememberedEmail = () => {
    try {
      localStorage.removeItem(REMEMBER_KEY);
    } catch (error) {
      console.warn('Não foi possível limpar preferências de login.', error);
    }
  };

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

  const savedEmail = getRememberedEmail();
  if (savedEmail && emailInput) {
    emailInput.value = savedEmail;
    if (rememberInput) rememberInput.checked = true;
  }

  const sessionEmail = readSessionEmail();
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

      const { persisted } = setSessionEmail(email);
      if (!persisted) {
        clearSessionEmail();
        showFeedback(
          'Não foi possível ativar a sessão porque o armazenamento do navegador está bloqueado. Libere cookies/armazenamento e tente novamente.',
          'error'
        );
        return;
      }

      if (rememberInput?.checked) setRememberedEmail(email);
      else clearRememberedEmail();

      showFeedback('Login realizado com sucesso! Em instantes você será redirecionado para a área do cliente.', 'success');
      window.setTimeout(() => {
        window.location.href = '../perfil-cliente.html';
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
ready(() => {
  setupPageTransitions();
  updateYear();
  initAuthState();
  initLoginForm();
  initCartBadge();
});
