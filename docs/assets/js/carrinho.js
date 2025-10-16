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
const storageModule = namespace.storage || null;

const fallbackNormalizeId = (value) => (value ?? '').toString();
const fallbackCoerceQuantity = (value) => {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? Math.min(numeric, 99) : 1;
};

const normalizeId = cartModule?.normalizeId || fallbackNormalizeId;
const coerceQuantity = (value) =>
  cartModule?.coerceQuantity ? cartModule.coerceQuantity(value, { min: 1, max: 99 }) : fallbackCoerceQuantity(value);

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

const persistSharedCart = (items, { silent = false, origin = 'cart' } = {}) => {
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

const couponStorage = storageModule?.local || null;

readyFn(() => {
  const cartList = document.querySelector('[data-cart-list]');
  if (!cartList) return;

  const summaryEl = document.querySelector('[data-cart-summary]');
  const emptyEl = document.querySelector('[data-cart-empty]');
  const subtotalEl = document.querySelector('[data-cart-subtotal]');
  const discountRow = document.querySelector('[data-cart-discount-row]');
  const discountEl = document.querySelector('[data-cart-discount]');
  const shippingEl = document.querySelector('[data-cart-shipping]');
  const totalEl = document.querySelector('[data-cart-total]');
  const couponForm = document.querySelector('[data-cart-coupon-form]');
  const couponInput = document.querySelector('[data-cart-coupon-input]');
  const couponFeedback = document.querySelector('[data-cart-coupon-feedback]');
  const suggestionsContainer = document.querySelector('[data-cart-suggestions]');
  const checkoutButton = document.querySelector('[data-cart-checkout]');
  const saveButton = document.querySelector('[data-cart-save]');

  const COUPON_KEY = 'mefit-cart-coupon';
  const FREE_SHIPPING_THRESHOLD = 299;
  const COUPONS = {
    PRIMEFRIDAY: { type: 'absolute', value: 30, label: 'Prime Friday' },
    MEFIT10: { type: 'percent', value: 0.1, label: 'MEFIT10' }
  };

  const source = cartList.getAttribute('data-source');

  let cartItems = loadSharedCart();
  let catalog = [];
  let catalogById = new Map();
  let activeCoupon = null;

  const parsePrice = (value) => {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  };

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const persistCart = ({ silent = false } = {}) => {
    cartItems = persistSharedCart(cartItems, { silent, origin: 'cart' });
  };

  const loadCart = () => loadSharedCart();

  const loadCoupon = () => {
    if (couponStorage) {
      return couponStorage.get(COUPON_KEY) ?? '';
    }
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return '';
    }
    try {
      return window.localStorage.getItem(COUPON_KEY) ?? '';
    } catch (error) {
      console.warn('Não foi possível recuperar o cupom salvo.', error);
      return '';
    }
  };

  const persistCoupon = (code) => {
    if (couponStorage) {
      if (code) {
        couponStorage.set(COUPON_KEY, code);
      } else {
        couponStorage.remove(COUPON_KEY);
      }
      return;
    }
    if (typeof window === 'undefined' || !('localStorage' in window)) {
      return;
    }
    try {
      if (code) {
        window.localStorage.setItem(COUPON_KEY, code);
      } else {
        window.localStorage.removeItem(COUPON_KEY);
      }
    } catch (error) {
      console.warn('Não foi possível armazenar o cupom.', error);
    }
  };

  const formatCurrency = (value) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const countCartItems = () =>
    cartModule?.count
      ? cartModule.count(cartItems)
      : cartItems.reduce((total, item) => total + (Number(item.quantidade) || 1), 0);

  const calculateSubtotal = () =>
    cartItems.reduce((total, item) => {
      const price = parsePrice(item.preco);
      const quantity = Number(item.quantidade) || 1;
      return total + price * quantity;
    }, 0);

  const isInCart = (productId) => {
    const normalizedId = normalizeId(productId);
    return cartItems.some((item) => normalizeId(item.id) === normalizedId);
  };

  const hydrateCartItems = () => {
    if (!catalogById.size || !cartItems.length) return;

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
          return { ...item, id: normalizedId };
        }

        const enhanced = {
          ...product,
          ...item,
          id: normalizedId,
          nome: product.nome ?? item.nome,
          preco: parsePrice(product.preco ?? item.preco),
          imagem: product.imagem ?? item.imagem,
          categoria: product.categoria ?? item.categoria,
          tamanhos: product.tamanhos ?? item.tamanhos
        };

        if (enhanced !== item) hasChanges = true;
        return enhanced;
      })
      .filter(Boolean);

    if (hasChanges) persistCart({ silent: true });
  };

  const toggleEmptyState = (isEmpty) => {
    if (cartList) {
      cartList.hidden = isEmpty;
    }
    if (emptyEl) {
      emptyEl.hidden = !isEmpty;
    }
    const buttons = [checkoutButton, saveButton];
    buttons.forEach((button) => {
      if (!button) return;
      if (isEmpty) {
        button.classList.add('is-disabled');
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('tabindex', '-1');
      } else {
        button.classList.remove('is-disabled');
        button.removeAttribute('aria-disabled');
        button.removeAttribute('tabindex');
      }
    });
  };

  const updateSummary = (subtotal) => {
    if (!summaryEl) return;
    const totalItems = countCartItems();
    if (!totalItems) {
      summaryEl.textContent =
        'Você ainda não adicionou produtos. Volte ao catálogo para montar o seu combo.';
      return;
    }

    const itemLabel = totalItems === 1 ? 'item' : 'itens';
    summaryEl.textContent = `Você selecionou ${totalItems} ${itemLabel} somando ${formatCurrency(
      subtotal
    )}.`;
  };

  const calculateDiscount = (subtotal) => {
    if (!activeCoupon || !subtotal) return 0;
    if (activeCoupon.type === 'percent') {
      return subtotal * activeCoupon.value;
    }
    if (activeCoupon.type === 'absolute') {
      return activeCoupon.value;
    }
    return 0;
  };

  const updateTotals = (subtotal) => {
    const discount = Math.min(calculateDiscount(subtotal), subtotal);
    const total = Math.max(subtotal - discount, 0);

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

    if (discountRow && discountEl) {
      if (discount > 0) {
        discountRow.hidden = false;
        discountEl.textContent = `- ${formatCurrency(discount)}${
          activeCoupon?.label ? ` (${activeCoupon.label})` : ''
        }`;
      } else {
        discountRow.hidden = true;
      }
    }

    if (shippingEl) {
      if (!subtotal) {
        shippingEl.textContent = 'Adicione itens para calcular o frete.';
      } else if (subtotal >= FREE_SHIPPING_THRESHOLD) {
        shippingEl.textContent = 'Grátis (acima de R$ 299)';
      } else {
        const difference = FREE_SHIPPING_THRESHOLD - subtotal;
        shippingEl.textContent = `Faltam ${formatCurrency(difference)} para frete grátis.`;
      }
    }

    if (totalEl) totalEl.textContent = formatCurrency(total);
  };

  const renderCartItems = () => {
    if (!cartList) return;
    if (!cartItems.length) {
      cartList.innerHTML = '';
      return;
    }

    cartList.innerHTML = cartItems
      .map((item) => {
        const productId = normalizeId(item.id);
        const quantity = coerceQuantity(item.quantidade);
        const price = parsePrice(item.preco);
        const lineTotal = price * quantity;
        const sizes = Array.isArray(item.tamanhos) ? item.tamanhos.join(', ') : '';
        const meta = [item.categoria, sizes ? `Tamanhos: ${sizes}` : null]
          .filter(Boolean)
          .join(' • ');
        const imageSrc = item.imagem || './assets/img/sample1.png';
        const itemLabel = `Quantidade de ${item.nome ?? 'produto'}`;
        return `
        <li class="cart-item" data-cart-item="${escapeHtml(productId)}">
          <div class="cart-thumb" aria-hidden="true">
            <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(item.nome ?? '')}" loading="lazy">
          </div>
          <div class="cart-item-body">
            <div class="cart-item-header">
              <h3>${escapeHtml(item.nome ?? '')}</h3>
              <button class="profile-link" type="button" data-cart-remove>Remover</button>
            </div>
            <p class="cart-item-meta">${escapeHtml(meta || 'Produto selecionado')}</p>
            <div class="cart-item-controls">
              <label>
                Qtde
                <input type="number" min="1" max="99" value="${quantity}" aria-label="${escapeHtml(
          itemLabel
        )}" data-cart-quantity>
              </label>
              <span class="cart-price" aria-label="Valor unitário">${formatCurrency(price)}</span>
              <span class="cart-line-total" aria-label="Total do item">${formatCurrency(lineTotal)}</span>
            </div>
          </div>
        </li>
      `;
      })
      .join('');
  };

  const clearCouponFeedback = () => {
    if (!couponFeedback) return;
    couponFeedback.hidden = true;
    couponFeedback.textContent = '';
    couponFeedback.classList.remove('is-error', 'is-success');
  };

  const showCouponFeedback = (message, type = 'success') => {
    if (!couponFeedback) return;
    couponFeedback.textContent = message;
    couponFeedback.hidden = false;
    couponFeedback.classList.remove('is-error', 'is-success');
    couponFeedback.classList.add(type === 'error' ? 'is-error' : 'is-success');
  };

  const applyCouponCode = (code, { showFeedback = true } = {}) => {
    const normalized = normalizeId(code).trim().toUpperCase();

    if (!normalized) {
      if (activeCoupon) {
        activeCoupon = null;
        persistCoupon('');
        if (showFeedback) {
          showCouponFeedback('Cupom removido com sucesso.', 'success');
        }
      }
      return true;
    }

    const coupon = COUPONS[normalized];
    if (!coupon) {
      if (showFeedback) {
        showCouponFeedback('Cupom não reconhecido. Verifique o código informado.', 'error');
      }
      return false;
    }

    if (!cartItems.length) {
      if (showFeedback) {
        showCouponFeedback('Adicione produtos antes de aplicar um cupom.', 'error');
      }
      return false;
    }

    activeCoupon = { ...coupon, code: normalized };
    persistCoupon(normalized);
    if (showFeedback) {
      showCouponFeedback(`Cupom ${normalized} aplicado!`, 'success');
    }
    if (couponInput) couponInput.value = normalized;
    return true;
  };

  const ensureCouponValidity = () => {
    if (!cartItems.length && activeCoupon) {
      activeCoupon = null;
      persistCoupon('');
      clearCouponFeedback();
    }
  };

  const addProductToCart = (product) => {
    if (!product?.id) return;
    const productId = normalizeId(product.id);
    if (!productId || isInCart(productId)) return;

    const item = {
      id: productId,
      nome: product.nome,
      preco: parsePrice(product.preco),
      imagem: product.imagem,
      categoria: product.categoria,
      tamanhos: product.tamanhos,
      quantidade: 1
    };
    cartItems.push(item);
    persistCart();
    ensureCouponValidity();
    updateCartView();
  };

  const removeFromCart = (productId) => {
    const normalizedId = normalizeId(productId);
    const previousLength = cartItems.length;
    cartItems = cartItems.filter((item) => normalizeId(item.id) !== normalizedId);
    if (cartItems.length === previousLength) return;
    persistCart();
    ensureCouponValidity();
    updateCartView();
  };

  const updateQuantity = (productId, quantity) => {
    const normalizedId = normalizeId(productId);
    const target = cartItems.find((item) => normalizeId(item.id) === normalizedId);
    if (!target) return;
    const coerced = coerceQuantity(quantity);
    if (coerced === target.quantidade) return;
    target.quantidade = coerced;
    persistCart();
    updateCartView();
  };

  const updateCartView = () => {
    hydrateCartItems();
    ensureCouponValidity();
    const subtotal = calculateSubtotal();
    renderCartItems();
    toggleEmptyState(cartItems.length === 0);
    updateSummary(subtotal);
    updateTotals(subtotal);
    renderSuggestions();
  };

  const renderSuggestions = () => {
    if (!suggestionsContainer) return;

    if (!catalog.length) {
      suggestionsContainer.innerHTML =
        '<p class="cart-empty">Não foi possível carregar as sugestões agora. Volte em instantes ou explore o catálogo completo.</p>';
      return;
    }

    const available = catalog.filter((product) => !isInCart(product.id));
    const suggestions = available.slice(0, 3);

    if (!suggestions.length) {
      suggestionsContainer.innerHTML =
        '<p class="cart-empty">Você já adicionou todos os itens recomendados. Confira outras categorias no catálogo.</p>';
      return;
    }

    suggestionsContainer.innerHTML = suggestions
      .map((product) => {
        const description = product.descricao
          ? `${product.descricao}`
          : 'Produto selecionado do catálogo M.E FIT.';
        return `
        <article class="recommend-card" data-cart-suggestion="${escapeHtml(normalizeId(product.id))}">
          <h3>${escapeHtml(product.nome ?? 'Produto M.E FIT')}</h3>
          <p>${escapeHtml(description)}</p>
          <span class="price">${formatCurrency(product.preco)}</span>
          <button class="btn btn-outline" type="button" data-cart-add>Adicionar</button>
        </article>
      `;
      })
      .join('');
  };

  cartList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cart-remove]');
    if (!button) return;
    const itemEl = button.closest('[data-cart-item]');
    if (!itemEl) return;
    removeFromCart(itemEl.getAttribute('data-cart-item'));
  });

  cartList.addEventListener('change', (event) => {
    const input = event.target.closest('[data-cart-quantity]');
    if (!input) return;
    const itemEl = input.closest('[data-cart-item]');
    if (!itemEl) return;
    updateQuantity(itemEl.getAttribute('data-cart-item'), input.value);
  });

  if (checkoutButton) {
    checkoutButton.addEventListener('click', (event) => {
      if (checkoutButton.classList.contains('is-disabled')) {
        event.preventDefault();
      }
    });
  }

  if (saveButton) {
    saveButton.addEventListener('click', (event) => {
      if (saveButton.classList.contains('is-disabled')) {
        event.preventDefault();
      }
    });
  }

  if (suggestionsContainer) {
    suggestionsContainer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-add]');
      if (!button) return;
      const card = button.closest('[data-cart-suggestion]');
      if (!card) return;
      const productId = card.getAttribute('data-cart-suggestion');
      const product = catalogById.get(normalizeId(productId));
      if (!product) return;
      addProductToCart(product);
    });
  }

  if (couponForm) {
    couponForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const code = couponInput?.value ?? '';
      const applied = applyCouponCode(code, { showFeedback: true });
      if (applied) {
        const subtotal = calculateSubtotal();
        updateTotals(subtotal);
      }
    });
  }

  if (couponInput) {
    couponInput.addEventListener('input', () => {
      clearCouponFeedback();
    });
  }

  const syncFromStorage = () => {
    cartItems = loadCart();
    hydrateCartItems();
    updateCartView();
  };

  window.addEventListener('storage', (event) => {
    if (event.key && event.key !== CART_KEY) return;
    syncFromStorage();
  });

  window.addEventListener('cart:changed', (event) => {
    if (event.detail?.origin === 'cart') return;
    syncFromStorage();
  });

  const loadCatalog = async () => {
    if (!source) return;
    try {
      const response = await fetch(source, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Erro ao buscar produtos: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Formato de produtos inválido.');
      }
      catalog = data;
      catalogById = new Map(
        data.map((product) => [normalizeId(product.id), { ...product, preco: parsePrice(product.preco) }])
      );
    } catch (error) {
      console.warn('Não foi possível carregar o catálogo para o carrinho.', error);
    }
  };

  const start = async () => {
    cartItems = loadCart();
    const storedCoupon = loadCoupon();
    await loadCatalog();
    hydrateCartItems();
    if (storedCoupon) {
      applyCouponCode(storedCoupon, { showFeedback: false });
    }
    updateCartView();
  };

  start();
});
