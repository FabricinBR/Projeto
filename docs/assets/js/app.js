const ready = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
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

const initLoginForm = () => {
  const loginForm = document.querySelector('#login-form');
  if (!loginForm) return;

  const emailInput = loginForm.querySelector('input[name="email"]');
  const passwordInput = loginForm.querySelector('input[name="password"]');
  const rememberInput = loginForm.querySelector('input[name="remember"]');
  const feedbackEl = loginForm.querySelector('.form-feedback');
  const submitButton = loginForm.querySelector('button[type="submit"]');
  const toggleButton = loginForm.querySelector('[data-toggle-password]');

  const REMEMBER_KEY = 'mefit-remember-email';
  const SESSION_KEY = 'mefit-session-email';

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

  const savedEmail = localStorage.getItem(REMEMBER_KEY);
  if (savedEmail && emailInput) {
    emailInput.value = savedEmail;
    if (rememberInput) rememberInput.checked = true;
  }

  const sessionEmail = sessionStorage.getItem(SESSION_KEY);
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

      sessionStorage.setItem(SESSION_KEY, email);
      if (rememberInput?.checked) {
        localStorage.setItem(REMEMBER_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      showFeedback('Login realizado com sucesso! Em instantes você será redirecionado para a página inicial.', 'success');
      window.setTimeout(() => {
        window.location.href = '../index.html';
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
  initLoginForm();
  initCartBadge();
});
