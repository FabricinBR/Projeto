const ready = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
};

const AUTH_SESSION_KEY = 'mefit-session-email';
const AUTH_REMEMBER_KEY = 'mefit-remember-email';

let sessionWarningShown = false;

const warnSessionAccess = (message, error) => {
  if (sessionWarningShown) return;
  sessionWarningShown = true;
  console.warn(message, error);
};

const readSessionEmail = () => {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) {
    return '';
  }

  try {
    const value = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    return typeof value === 'string' ? value : '';
  } catch (error) {
    warnSessionAccess('Não foi possível acessar a sessão do cliente.', error);
    return '';
  }
};

const writeSessionEmail = (email) => {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) {
    return false;
  }

  try {
    if (!email) {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(AUTH_SESSION_KEY, email);
    }
    return true;
  } catch (error) {
    warnSessionAccess('Não foi possível atualizar a sessão do cliente.', error);
    return false;
  }
};

const dispatchAuthChange = () => {
  const email = readSessionEmail();
  document.dispatchEvent(
    new CustomEvent('auth:changed', {
      detail: { email }
    })
  );
  return email;
};

const setSessionEmail = (email) => {
  writeSessionEmail(email);
  return dispatchAuthChange();
};

const clearSessionEmail = () => {
  writeSessionEmail('');
  return dispatchAuthChange();
};

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
    return {
      ...entry,
      id,
      quantidade: coerceQuantity(entry.quantidade)
    };
  }

  return null;
};

const loadCartItems = () => {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return [];
  }
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

const initAuthState = () => {
  const protectedAreas = Array.from(document.querySelectorAll('[data-requires-auth]'));

  const syncAuthVisibility = () => {
    const email = readSessionEmail();
    const isAuthenticated = Boolean(email);

    document
      .querySelectorAll('[data-auth-visible="signed-in"]')
      .forEach((element) => setElementVisibility(element, isAuthenticated));

    document
      .querySelectorAll('[data-auth-visible="signed-out"]')
      .forEach((element) => setElementVisibility(element, !isAuthenticated));

    document.querySelectorAll('[data-auth-email]').forEach((element) => {
      if (isAuthenticated) {
        element.textContent = email;
        setElementVisibility(element, true);
      } else {
        element.textContent = '';
        setElementVisibility(element, false);
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

  document.querySelectorAll('[data-logout]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      clearSessionEmail();
      const redirect = element.getAttribute('data-logout-redirect');
      if (redirect) {
        window.location.href = redirect;
      }
    });
  });
};

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
      if (email) {
        localStorage.setItem(REMEMBER_KEY, email);
      }
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
    if (feedbackEl?.classList.contains('is-error')) {
      clearFeedback();
    }
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

      setSessionEmail(email);
      if (rememberInput?.checked) {
        setRememberedEmail(email);
      } else {
        clearRememberedEmail();
      }

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

ready(() => {
  updateYear();
  initAuthState();
  initLoginForm();
  initCartBadge();
});
