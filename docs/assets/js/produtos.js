const onDocumentReady = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
};

const initProducts = () => {
  const productGrid = document.querySelector('[data-product-grid]');
  if (!productGrid || productGrid.dataset.enhanced === 'true') return;
  productGrid.dataset.enhanced = 'true';

  const CART_KEY = 'mefit-cart-items';
  let cartItems = [];

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
  const cartCountBadge = document.querySelector('[data-cart-count]');

  const source = productGrid.getAttribute('data-source');
  let allProducts = [];

  // ---------- Utilidades de normalização ----------
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

  // ---------- Persistência do carrinho ----------
  const loadCart = () => {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return [];
    }
    try {
      const stored = localStorage.getItem(CART_KEY);
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
      console.warn('Não foi possível carregar o carrinho salvo.', error);
      return [];
    }
  };

  const saveCart = () => {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return;
    }
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.warn('Não foi possível salvar o carrinho.', error);
    }
  };

  const updateCartBadge = () => {
    if (!cartCountBadge) return;
    const total = cartItems.reduce((sum, item) => sum + (Number(item.quantidade) || 1), 0);
    cartCountBadge.textContent = String(total);
    cartCountBadge.hidden = total === 0;
  };

  const isInCart = (productId) => {
    const targetId = normalizeId(productId);
    return cartItems.some((item) => normalizeId(item.id) === targetId);
  };

  const setButtonState = (button, active) => {
    if (!button) return;
    button.textContent = active ? 'Remover do carrinho' : 'Adicionar ao carrinho';
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  };

  const hydrateCartItems = () => {
    if (!Array.isArray(allProducts) || !allProducts.length || !cartItems.length) return;

    const catalogById = new Map(
      allProducts.map((product) => [normalizeId(product.id), product])
    );

    let hasChanges = false;
    cartItems = cartItems
      .map((item) => {
        const normalizedId = normalizeId(item?.id);
        if (!normalizedId) {
          hasChanges = true;
          return null;
        }

        const product = catalogById.get(normalizedId);
        if (!product) {
          if (normalizedId !== item.id) {
            hasChanges = true;
            return { ...item, id: normalizedId };
          }
          return item;
        }

        // Completa metadados ausentes do item do carrinho
        if (item?.nome && item.preco != null && item.imagem) {
          if (normalizedId !== item.id) {
            hasChanges = true;
            return { ...item, id: normalizedId };
          }
          return item;
        }

        hasChanges = true;
        return {
          ...item,
          id: normalizedId,
          nome: product.nome,
          preco: product.preco,
          imagem: product.imagem,
          categoria: product.categoria,
          tamanhos: product.tamanhos
        };
      })
      .filter(Boolean);

    if (hasChanges) saveCart();
  };

  const updateButtonsForProduct = (productId) => {
    const normalizedId = normalizeId(productId);
    const buttons = productGrid.querySelectorAll(`[data-product-id="${normalizedId}"]`);
    const active = isInCart(normalizedId);
    buttons.forEach((button) => setButtonState(button, active));
  };

  const addToCart = (product) => {
    if (!product?.id) return;
    const normalizedId = normalizeId(product.id);
    if (!normalizedId) return;
    if (isInCart(normalizedId)) return;

    const item = {
      id: normalizedId,
      nome: product.nome,
      preco: product.preco,
      imagem: product.imagem,
      categoria: product.categoria,
      tamanhos: product.tamanhos,
      quantidade: 1
    };
    cartItems.push(item);
    saveCart();
    updateCartBadge();
  };

  const removeFromCart = (productId) => {
    const targetId = normalizeId(productId);
    const previousLength = cartItems.length;
    cartItems = cartItems.filter((item) => normalizeId(item.id) !== targetId);
    if (cartItems.length === previousLength) return;
    saveCart();
    updateCartBadge();
  };

  const toggleCartItem = (product) => {
    if (!product?.id) return;
    const normalizedId = normalizeId(product.id);
    if (isInCart(normalizedId)) {
      removeFromCart(normalizedId);
      return;
    }
    addToCart(product);
  };

  cartItems = loadCart();
  updateCartBadge();

  const formatCurrency = (value) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const updateCount = (visible, total) => {
    if (!countEl) return;
    if (!total) {
      countEl.textContent = 'Nenhum produto disponível no momento.';
      return;
    }
    const label =
      visible === total
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
    productGrid.innerHTML = items
      .map((product) => {
        const productId = normalizeId(product.id);
        const sizes = Array.isArray(product.tamanhos) ? product.tamanhos.join(', ') : '';
        const meta = [product.categoria, sizes ? `Tamanhos: ${sizes}` : null]
          .filter(Boolean)
          .join(' • ');
        const inCart = isInCart(productId);
        const buttonClass = inCart ? 'btn btn-primary is-active' : 'btn btn-primary';
        const buttonLabel = inCart ? 'Remover do carrinho' : 'Adicionar ao carrinho';
        const ariaPressed = inCart ? 'true' : 'false';
        return `
        <article class="p-card">
          <div class="p-thumb"><img src="${product.imagem}" alt="${product.nome}" loading="lazy"></div>
          <h3>${product.nome}</h3>
          <p class="product-meta">${meta}</p>
          <p class="price">${formatCurrency(product.preco)}</p>
          <button class="${buttonClass}" type="button" data-cart-toggle data-product-id="${productId}" aria-pressed="${ariaPressed}">${buttonLabel}</button>
        </article>
      `;
      })
      .join('');
  };

  const applyFilters = () => {
    let filtered = [...allProducts];

    const query = searchInput?.value.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((product) =>
        product.nome.toLowerCase().includes(query)
      );
    }

    const category = categorySelect?.value;
    if (category) {
      filtered = filtered.filter((product) => product.categoria === category);
    }

    const size = sizeSelect?.value;
    if (size) {
      filtered = filtered.filter(
        (product) => Array.isArray(product.tamanhos) && product.tamanhos.includes(size)
      );
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
    const categories = Array.from(new Set(allProducts.map((p) => p.categoria)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (categorySelect) {
      categorySelect.innerHTML =
        '<option value="">Todas as categorias</option>' +
        categories.map((c) => `<option value="${c}">${c}</option>`).join('');
    }

    const sizes = Array.from(
      new Set(
        allProducts.flatMap((p) => (Array.isArray(p.tamanhos) ? p.tamanhos : []))
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (sizeSelect) {
      sizeSelect.innerHTML =
        '<option value="">Todos os tamanhos</option>' +
        sizes.map((s) => `<option value="${s}">${s}</option>`).join('');
    }

    const prices = allProducts
      .map((p) => Number(p.preco))
      .filter((price) => !Number.isNaN(price));
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
    [searchInput, categorySelect, sizeSelect, minPriceInput, maxPriceInput].forEach(
      (input) => {
        if (!input) return;
        const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
        input.addEventListener(eventName, handleFiltersChange);
      }
    );

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

    productGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-toggle]');
      if (!button) return;
      const productId = normalizeId(button.getAttribute('data-product-id'));
      const product = allProducts.find((item) => normalizeId(item.id) === productId);
      if (!product) return;
      toggleCartItem(product);
      updateButtonsForProduct(productId);
      button.blur();
    });
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
      hydrateCartItems();
      populateFilters();
      handleFiltersChange();
      attachListeners();
    } catch (error) {
      console.error(error);
      if (countEl)
        countEl.textContent =
          'Não foi possível carregar o catálogo agora. Tente novamente mais tarde.';
      if (loadingEl) loadingEl.hidden = true;
    }
  };

  loadProducts();
};

onDocumentReady(initProducts);
