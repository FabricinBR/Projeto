const namespace = window.MEFIT || {};
const readyFn =
  namespace.utils?.ready ||
  ((callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  });

const cartModule = namespace.cart || null;
const uiModule = namespace.ui || null;

const fallbackNormalizeId = (value) => (value ?? '').toString();
const fallbackCoerceQuantity = (value) => {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? Math.min(numeric, 99) : 1;
};

const normalizeId = cartModule?.normalizeId || fallbackNormalizeId;
const ensureCartBadgeFallback = () => {
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

const CART_KEY = cartModule?.STORAGE_KEY || 'mefit-cart-items';

const loadSharedCart = () => {
  if (cartModule?.load) {
    return cartModule.load({ maxQuantity: 99 });
  }

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
      .map((entry) => {
        if (entry == null) return null;

        if (typeof entry === 'string' || typeof entry === 'number') {
          const id = fallbackNormalizeId(entry);
          return id ? { id, quantidade: 1 } : null;
        }

        if (typeof entry === 'object') {
          const id = fallbackNormalizeId(entry.id);
          if (!id) return null;
          return {
            ...entry,
            id,
            quantidade: fallbackCoerceQuantity(entry.quantidade)
          };
        }

        return null;
      })
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

const persistSharedCart = (items, { silent = false, origin = 'catalog' } = {}) => {
  if (cartModule?.persist) {
    return cartModule.persist(items, { dispatch: !silent, origin, maxQuantity: 99 });
  }

  const sanitized = Array.isArray(items)
    ? items
        .map((entry) => {
          if (entry == null) return null;
          if (typeof entry === 'object') {
            const id = fallbackNormalizeId(entry.id);
            if (!id) return null;
            return { ...entry, id, quantidade: fallbackCoerceQuantity(entry.quantidade) };
          }
          const id = fallbackNormalizeId(entry);
          return id ? { id, quantidade: 1 } : null;
        })
        .filter((item, index, list) => {
          if (!item?.id) return false;
          return list.findIndex((candidate) => candidate?.id === item.id) === index;
        })
    : [];

  if (typeof window !== 'undefined' && 'localStorage' in window) {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(sanitized));
    } catch (error) {
      console.warn('Não foi possível salvar o carrinho.', error);
    }
  }

  if (!silent) {
    window.dispatchEvent(
      new CustomEvent('cart:changed', {
        detail: {
          origin,
          items: sanitized.map((item) => ({ ...item }))
        }
      })
    );
  }

  return sanitized;
};

const initProducts = () => {
  const productGrid = document.querySelector('[data-product-grid]');
  if (!productGrid || productGrid.dataset.enhanced === 'true') return;
  productGrid.dataset.enhanced = 'true';

  let cartItems = loadSharedCart();

  const ensureCartBadge = () => {
    if (uiModule?.ensureCartBadge) {
      return uiModule.ensureCartBadge();
    }
    return ensureCartBadgeFallback();
  };

  const animateAddToCart = (productCard) => {
    if (!productCard) return;

    const image = productCard.querySelector('.p-thumb img');
    if (!image) return;

    // Alvo da animação: badge visível; senão, link do carrinho
    const cartLink = document.querySelector('.nav a[href$="carrinho.html"]');
    const cartTarget =
      cartCountBadge &&
      !cartCountBadge.hidden &&
      cartCountBadge.offsetParent !== null
        ? cartCountBadge
        : cartLink;

    if (!cartTarget) return;

    const imageRect = image.getBoundingClientRect();
    const targetRect = cartTarget.getBoundingClientRect();

    if (!imageRect.width || !imageRect.height) return;

    const clone = image.cloneNode(true);
    clone.classList.add('product-fly-clone');
    clone.style.left = `${imageRect.left}px`;
    clone.style.top = `${imageRect.top}px`;
    clone.style.width = `${imageRect.width}px`;
    clone.style.height = `${imageRect.height}px`;
    clone.style.transform = 'translate3d(0, 0, 0)';
    clone.style.opacity = '1';

    document.body.appendChild(clone);

    // Força reflow antes da transição (garante início da animação)
    clone.getBoundingClientRect();

    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const imageCenterX = imageRect.left + imageRect.width / 2;
    const imageCenterY = imageRect.top + imageRect.height / 2;

    const translateX = targetX - imageCenterX;
    const translateY = targetY - imageCenterY;

    const performAnimation = () => {
      clone.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(0.2)`;
      clone.style.opacity = '0';
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(performAnimation);
    });

    const removeClone = () => {
      clone.removeEventListener('transitionend', removeClone);
      clone.remove();
    };

    clone.addEventListener('transitionend', removeClone);

    window.setTimeout(() => {
      if (clone.isConnected) {
        clone.removeEventListener('transitionend', removeClone);
        clone.remove();
      }
    }, 900);
  };

  const filtersForm = document.querySelector('[data-product-filters]');
  const searchInput = document.querySelector('[data-product-search]');
  const categorySelect = document.querySelector('[data-filter-category]');
  const colorSelect = document.querySelector('[data-filter-color]');
  const sizeSelect = document.querySelector('[data-filter-size]');
  const minPriceInput = document.querySelector('[data-filter-min-price]');
  const maxPriceInput = document.querySelector('[data-filter-max-price]');
  const sortSelect = document.querySelector('[data-sort-products]');
  const clearButton = document.querySelector('[data-product-clear]');
  const countEl = document.querySelector('[data-product-count]');
  const emptyEl = document.querySelector('[data-product-empty]');
  const loadingEl = document.querySelector('[data-product-loading]');
  const cartCountBadge = ensureCartBadge();

  const source = productGrid.getAttribute('data-source');
  let allProducts = [];

  // ---------- Persistência do carrinho ----------
  const loadCart = () => loadSharedCart();

  const persistCart = ({ silent = false } = {}) => {
    cartItems = persistSharedCart(cartItems, { silent, origin: 'catalog' });
  };

  const updateCartBadge = () => {
    if (!cartCountBadge) return;
    const total = cartModule?.count
      ? cartModule.count(cartItems)
      : cartItems.reduce((sum, item) => sum + (Number(item.quantidade) || 1), 0);
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

    if (hasChanges) persistCart({ silent: true });
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
    persistCart();
    updateCartBadge();
  };

  const removeFromCart = (productId) => {
    const targetId = normalizeId(productId);
    const previousLength = cartItems.length;
    cartItems = cartItems.filter((item) => normalizeId(item.id) !== targetId);
    if (cartItems.length === previousLength) return;
    persistCart();
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
        const colors = Array.isArray(product.cores) ? product.cores.join(', ') : '';
        const metaParts = [
          product.categoria,
          sizes ? `Tamanhos: ${sizes}` : null,
          colors ? `Cores: ${colors}` : null
        ].filter(Boolean);
        const meta = metaParts.join(' • ');
        const inCart = isInCart(productId);
        const buttonClass = inCart ? 'btn btn-primary is-active' : 'btn btn-primary';
        const buttonLabel = inCart ? 'Remover do carrinho' : 'Adicionar ao carrinho';
        const ariaPressed = inCart ? 'true' : 'false';
        const detailUrl = product.slug
          ? `./produto.html?slug=${encodeURIComponent(product.slug)}`
          : './produto.html';
        return `
        <article class="p-card">
          <a class="p-thumb" href="${detailUrl}"><img src="${product.imagem}" alt="${product.nome}" loading="lazy"></a>
          <h3><a href="${detailUrl}">${product.nome}</a></h3>
          <p class="product-meta">${meta || ''}</p>
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

    const color = colorSelect?.value;
    if (color) {
      filtered = filtered.filter(
        (product) => Array.isArray(product.cores) && product.cores.includes(color)
      );
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

    const sortValue = sortSelect?.value || 'relevance';
    const sorted = [...filtered];

    const byOriginalOrder = (a, b) => (a._index ?? 0) - (b._index ?? 0);
    const toNumber = (value) => Number(value) || 0;

    switch (sortValue) {
      case 'price-asc':
        sorted.sort((a, b) => toNumber(a.preco) - toNumber(b.preco));
        break;
      case 'price-desc':
        sorted.sort((a, b) => toNumber(b.preco) - toNumber(a.preco));
        break;
      case 'newest':
        sorted.sort((a, b) => (b.ordemRecente ?? toNumber(b.id)) - (a.ordemRecente ?? toNumber(a.id)));
        break;
      default:
        sorted.sort(byOriginalOrder);
    }

    return sorted;
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

    const colors = Array.from(
      new Set(
        allProducts.flatMap((p) => (Array.isArray(p.cores) ? p.cores : []))
      )
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (colorSelect) {
      colorSelect.innerHTML =
        '<option value="">Todas as cores</option>' +
        colors.map((color) => `<option value="${color}">${color}</option>`).join('');
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

    if (sortSelect) {
      sortSelect.value = 'relevance';
    }
  };

  const handleFiltersChange = () => {
    if (loadingEl) loadingEl.hidden = true;
    const filtered = applyFilters();
    renderProducts(filtered);
    updateCount(filtered.length, allProducts.length);
  };

  const attachListeners = () => {
    [
      searchInput,
      categorySelect,
      colorSelect,
      sizeSelect,
      minPriceInput,
      maxPriceInput,
      sortSelect
    ].forEach(
      (input) => {
        if (!input) return;
        const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
        input.addEventListener(eventName, handleFiltersChange);
      }
    );

    if (filtersForm) {
      filtersForm.addEventListener('reset', () => {
        window.requestAnimationFrame(() => {
          if (sortSelect) sortSelect.value = 'relevance';
          handleFiltersChange();
        });
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        if (filtersForm) {
          filtersForm.reset();
        }
        if (sortSelect) sortSelect.value = 'relevance';
      });
    }

    productGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-toggle]');
      if (!button) return;
      const productId = normalizeId(button.getAttribute('data-product-id'));
      const product = allProducts.find((item) => normalizeId(item.id) === productId);
      if (!product) return;
      const alreadyInCart = isInCart(productId);
      toggleCartItem(product);
      updateButtonsForProduct(productId);
      if (!alreadyInCart && isInCart(productId)) {
        animateAddToCart(button.closest('.p-card'));
      }
      button.blur();
    });
  };

  const refreshCatalogView = () => {
    if (!Array.isArray(allProducts) || !allProducts.length) return;
    const filtered = applyFilters();
    renderProducts(filtered);
    updateCount(filtered.length, allProducts.length);
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

      allProducts = data.map((product, index) => ({
        ...product,
        _index: index,
        ordemRecente: Number(product?.ordemRecente ?? product?.id ?? index)
      }));
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

  const syncCartFromStorage = () => {
    cartItems = loadCart();
    updateCartBadge();
    refreshCatalogView();
  };

  window.addEventListener('storage', (event) => {
    if (event.key && event.key !== CART_KEY) return;
    syncCartFromStorage();
  });

  window.addEventListener('cart:changed', (event) => {
    if (event.detail?.origin === 'catalog') return;
    syncCartFromStorage();
  });
};

readyFn(initProducts);
