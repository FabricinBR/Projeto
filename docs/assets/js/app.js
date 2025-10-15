const updateYear = () => {
  const targets = document.querySelectorAll('#year, [data-current-year]');
  if (!targets.length) return;

  const currentYear = String(new Date().getFullYear());
  targets.forEach((element) => {
    element.textContent = currentYear;
  });
};

document.addEventListener('DOMContentLoaded', () => {
  updateYear();

  const loginForm = document.getElementById('login-form');
  if (!loginForm || loginForm.dataset.enhanced === 'true') {
    return;
  }
  loginForm.dataset.enhanced = 'true';

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
      if (shouldReveal) {
        const length = passwordInput.value.length;
        passwordInput.setSelectionRange(length, length);
      }
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
      await new Promise((resolve) => window.setTimeout(resolve, 600));

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
});
