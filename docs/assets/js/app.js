document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
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
      } else {
        if (submitButton.dataset.originalText) {
          submitButton.textContent = submitButton.dataset.originalText;
        }
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
          passwordInput.setSelectionRange(passwordInput.value.length, passwordInput.value.length);
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
        await new Promise((resolve) => setTimeout(resolve, 600));

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
        setTimeout(() => {
          window.location.href = '../index.html';
        }, 1000);
      } catch (error) {
        console.error('Falha ao simular login:', error);
        showFeedback('Não foi possível conectar agora. Tente novamente em alguns instantes.', 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  const productGrid = document.querySelector('[data-product-grid]');
  if (!productGrid) {
    return;
  }

  const filtersForm = document.querySelector('[data-product-filters]');
  const searchInput = document.querySelector('[data-product-search]');
  const categorySelect = document.querySelector('[data-filter-category]');
  const sizeSelect = document.querySelector('[data-filter-size]');
  const minPriceInput = document.querySelector('[data-filter-min-price]');
  const maxPriceInput = document.querySelector('[data-filter-max-price]');
  const clearButton = document.querySelector('[data-product-clear]');
  const countEl = document.querySelector('[data-product-count]');
  const emptyEl = document.querySelector('[data-product-empty]');
  const loadingEl = document.querySelector('[data-product-loading]');

  const source = productGrid.getAttribute('data-source');
  let allProducts = [];

  const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const updateCount = (visible, total) => {
    if (!countEl) return;
    if (!total) {
      countEl.textContent = 'Nenhum produto disponível no momento.';
      return;
    }
    const label = visible === total
      ? `${visible} ${visible === 1 ? 'produto' : 'produtos'} disponíveis.`
      : `Exibindo ${visible} de ${total} produtos.`;
    countEl.textContent = label;
  };

  const renderProducts = (items) => {
    if (!emptyEl) return;
    if (!items.length) {
      productGrid.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    productGrid.innerHTML = items.map((product) => {
      const sizes = Array.isArray(product.tamanhos) ? product.tamanhos.join(', ') : '';
      const meta = [product.categoria, sizes ? `Tamanhos: ${sizes}` : null].filter(Boolean).join(' • ');
      return `
        <article class="p-card">
          <div class="p-thumb"><img src="${product.imagem}" alt="${product.nome}" loading="lazy"></div>
          <h3>${product.nome}</h3>
          <p class="product-meta">${meta}</p>
          <p class="price">${formatCurrency(product.preco)}</p>
          <button class="btn btn-primary" type="button">Adicionar ao carrinho</button>
        </article>
      `;
    }).join('');
  };

  const applyFilters = () => {
    let filtered = [...allProducts];

    const query = searchInput?.value.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((product) => product.nome.toLowerCase().includes(query));
    }

    const category = categorySelect?.value;
    if (category) {
      filtered = filtered.filter((product) => product.categoria === category);
    }

    const size = sizeSelect?.value;
    if (size) {
      filtered = filtered.filter((product) => Array.isArray(product.tamanhos) && product.tamanhos.includes(size));
    }

    const minPrice = minPriceInput?.value ? Number(minPriceInput.value) : null;
    const maxPrice = maxPriceInput?.value ? Number(maxPriceInput.value) : null;
    if (!Number.isNaN(minPrice) && minPrice !== null) {
      filtered = filtered.filter((product) => Number(product.preco) >= minPrice);
    }
    if (!Number.isNaN(maxPrice) && maxPrice !== null) {
      filtered = filtered.filter((product) => Number(product.preco) <= maxPrice);
    }

    return filtered;
  };

  const populateFilters = () => {
    const categories = Array.from(new Set(allProducts.map((product) => product.categoria))).sort((a, b) => a.localeCompare(b));
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Todas as categorias</option>' + categories.map((category) => `<option value="${category}">${category}</option>`).join('');
    }

    const sizes = Array.from(new Set(allProducts.flatMap((product) => Array.isArray(product.tamanhos) ? product.tamanhos : [])));
    sizes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (sizeSelect) {
      sizeSelect.innerHTML = '<option value="">Todos os tamanhos</option>' + sizes.map((size) => `<option value="${size}">${size}</option>`).join('');
    }

    const prices = allProducts.map((product) => Number(product.preco)).filter((price) => !Number.isNaN(price));
    if (prices.length) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (minPriceInput) {
        minPriceInput.placeholder = `Mín. ${formatCurrency(min)}`;
        minPriceInput.min = '0';
        minPriceInput.max = String(max);
      }
      if (maxPriceInput) {
        maxPriceInput.placeholder = `Máx. ${formatCurrency(max)}`;
        maxPriceInput.min = '0';
        maxPriceInput.max = String(max);
      }
    }
  };

  const handleFiltersChange = () => {
    if (loadingEl) loadingEl.hidden = true;
    const filtered = applyFilters();
    renderProducts(filtered);
    updateCount(filtered.length, allProducts.length);
  };

  const attachListeners = () => {
    [searchInput, categorySelect, sizeSelect, minPriceInput, maxPriceInput].forEach((input) => {
      if (!input) return;
      const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
      input.addEventListener(eventName, handleFiltersChange);
    });

    if (filtersForm) {
      filtersForm.addEventListener('reset', () => {
        window.requestAnimationFrame(handleFiltersChange);
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        if (filtersForm) {
          filtersForm.reset();
        }
      });
    }
  };

  const loadProducts = async () => {
    if (!source) {
      console.error('Fonte de produtos não definida.');
      if (countEl) countEl.textContent = 'Não foi possível carregar os produtos.';
      return;
    }

    try {
      if (loadingEl) loadingEl.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
      if (countEl) countEl.textContent = 'Carregando produtos...';
      const response = await fetch(source, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Erro ao buscar produtos: ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Formato de produtos inválido.');
      }

      allProducts = data;
      populateFilters();
      handleFiltersChange();
      attachListeners();
    } catch (error) {
      console.error(error);
      if (countEl) countEl.textContent = 'Não foi possível carregar o catálogo agora. Tente novamente mais tarde.';
      if (loadingEl) loadingEl.hidden = true;
    }
  };

  loadProducts();
});
