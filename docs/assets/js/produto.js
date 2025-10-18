(function (global) {
  const namespace = global.MEFIT || {};
  const doc = global.document;
  const ready =
    namespace.utils?.ready ||
    ((callback) => {
      if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', callback, { once: true });
      } else {
        callback();
      }
    });

  const cartModule = namespace.cart || null;
  const setVisibility =
    namespace.utils?.setElementVisibility ||
    ((element, shouldShow) => {
      if (!element) return;
      element.hidden = !shouldShow;
    });

  const formatCurrency = (value) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const slugify = (value) =>
    (value || '')
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .toLowerCase();

  const coerceQuantity = (value, max = 99) => {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric) || numeric <= 0) return 1;
    return Math.min(numeric, max);
  };

  const findProduct = (products, { slug, id }) => {
    if (!Array.isArray(products)) return null;
    if (slug) {
      const bySlug = products.find((item) => item?.slug === slug);
      if (bySlug) return bySlug;
    }
    if (id) {
      const byId = products.find((item) => String(item?.id) === String(id));
      if (byId) return byId;
    }
    return null;
  };

  const generateVariants = (product) => {
    const colors = Array.isArray(product?.cores) && product.cores.length ? product.cores : ['Único'];
    const sizes = Array.isArray(product?.tamanhos) && product.tamanhos.length ? product.tamanhos : ['Único'];

    const combos = [];
    colors.forEach((color, colorIndex) => {
      sizes.forEach((size, sizeIndex) => {
        const seed = (colorIndex + 1) * (sizeIndex + 2);
        const stock = Math.max(2, ((seed * 3) % 22) + 2);
        combos.push({
          id: `${product.id}-${slugify(color)}-${slugify(size)}`,
          color,
          size,
          stock,
          price: Number(product?.preco) || 0
        });
      });
    });
    return combos;
  };

  ready(async () => {
    const page = doc.querySelector('[data-product-page]');
    if (!page) return;

    const layout = page.querySelector('[data-product-layout]');
    const imageEl = page.querySelector('[data-product-image]');
    const nameEl = page.querySelector('[data-product-name]');
    const descriptionEl = page.querySelector('[data-product-description]');
    const priceEl = page.querySelector('[data-product-price]');
    const breadcrumbEl = page.querySelector('[data-product-breadcrumb]');
    const loadingEl = page.querySelector('[data-product-loading]');
    const emptyEl = page.querySelector('[data-product-empty]');
    const lowStockEl = page.querySelector('[data-low-stock]');
    const feedbackEl = page.querySelector('[data-add-feedback]');
    const addToCartButton = page.querySelector('[data-add-to-cart]');
    const goToCartButton = page.querySelector('[data-go-to-cart]');
    const colorContainer = page.querySelector('[data-variant-colors]');
    const sizeContainer = page.querySelector('[data-variant-sizes]');

    const buyNowBar = doc.querySelector('[data-buy-now-bar]');
    const buyNowButton = buyNowBar?.querySelector('[data-buy-now]');
    const buyNowVariant = buyNowBar?.querySelector('[data-buy-now-variant]');

    const source = page.getAttribute('data-product-source') || './assets/data/produtos.json';

    const params = new URLSearchParams(global.location.search);
    const requestedSlug = params.get('slug');
    const requestedId = params.get('id');

    let product = null;
    let variants = [];
    let selectedColor = '';
    let selectedSize = '';
    let colorButtons = [];
    let sizeButtons = [];

    const normalizeId = cartModule?.normalizeId || ((value) => String(value || ''));
    const sanitizeItems = cartModule?.sanitizeItems || ((items) => (Array.isArray(items) ? items.slice() : []));

    const buildVariantId = (baseProduct, variant) =>
      normalizeId(`${baseProduct.id}-${slugify(variant.color)}-${slugify(variant.size)}`);

    let cartItems = cartModule?.load ? cartModule.load({ maxQuantity: 99 }) : [];

    const updatePrimaryButtonState = () => {
      if (!addToCartButton || !product) return;
      const variant = variants.find((item) => item.color === selectedColor && item.size === selectedSize);
      if (!variant) return;
      const variantId = buildVariantId(product, variant);
      const exists = cartItems.some((item) => normalizeId(item.id) === variantId);
      addToCartButton.textContent = exists ? 'Adicionar mais uma unidade' : 'Adicionar ao carrinho';
    };

    const updateLowStockMessage = (variant) => {
      if (!lowStockEl) return;
      if (variant && Number(variant.stock) < 10) {
        lowStockEl.textContent = `Só ${variant.stock} unidades restantes!`;
        lowStockEl.hidden = false;
      } else {
        lowStockEl.hidden = true;
      }
    };

    const updateBuyNowInfo = (variant) => {
      if (!buyNowVariant) return;
      if (!variant) {
        buyNowVariant.textContent = 'Selecione cor e tamanho para comprar agora.';
        return;
      }
      const pieces = [variant.color, variant.size].filter(Boolean).join(' • ');
      buyNowVariant.textContent = pieces ? `Selecionado: ${pieces}` : 'Pronto para levar?';
    };

    const updatePrice = (variant) => {
      if (!priceEl) return;
      const value = variant?.price ?? product?.preco;
      priceEl.textContent = formatCurrency(value);
    };

    const getSelectedVariant = () =>
      variants.find((variant) => variant.color === selectedColor && variant.size === selectedSize) || null;

    const ensureValidSelection = () => {
      if (!variants.length) return;
      const availableColors = Array.from(new Set(variants.map((item) => item.color)));
      if (!availableColors.includes(selectedColor)) {
        selectedColor = availableColors[0];
      }
      const sizesForColor = variants
        .filter((variant) => variant.color === selectedColor)
        .map((variant) => variant.size);
      if (!sizesForColor.includes(selectedSize)) {
        selectedSize = sizesForColor[0];
      }
    };

    const renderColorOptions = () => {
      if (!colorContainer) return;
      colorContainer.innerHTML = '';
      colorButtons = [];
      const colors = Array.from(new Set(variants.map((variant) => variant.color)));
      colors.forEach((color) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'variant-option';
        button.dataset.value = color;
        button.textContent = color;
        button.addEventListener('click', () => {
          if (selectedColor === color) return;
          selectedColor = color;
          ensureValidSelection();
          updateOptionsState();
          updateProductView();
        });
        colorContainer.appendChild(button);
        colorButtons.push(button);
      });
    };

    const renderSizeOptions = () => {
      if (!sizeContainer) return;
      sizeContainer.innerHTML = '';
      sizeButtons = [];
      const sizes = Array.from(new Set(variants.map((variant) => variant.size)));
      sizes.forEach((size) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'variant-option';
        button.dataset.value = size;
        button.textContent = size;
        button.addEventListener('click', () => {
          if (button.disabled || selectedSize === size) return;
          selectedSize = size;
          updateOptionsState();
          updateProductView();
        });
        sizeContainer.appendChild(button);
        sizeButtons.push(button);
      });
    };

    const updateOptionsState = () => {
      const availableSizes = new Set(
        variants
          .filter((variant) => variant.color === selectedColor)
          .map((variant) => variant.size)
      );
      colorButtons.forEach((button) => {
        const value = button.dataset.value;
        button.classList.toggle('is-active', value === selectedColor);
      });
      sizeButtons.forEach((button) => {
        const value = button.dataset.value;
        const isAvailable = availableSizes.has(value);
        button.disabled = !isAvailable;
        button.classList.toggle('is-active', value === selectedSize);
        if (isAvailable) {
          button.removeAttribute('aria-disabled');
        } else {
          button.setAttribute('aria-disabled', 'true');
        }
      });
    };

    const updateProductView = () => {
      ensureValidSelection();
      updateOptionsState();
      const variant = getSelectedVariant();
      updatePrice(variant);
      updateLowStockMessage(variant);
      updatePrimaryButtonState();
      updateBuyNowInfo(variant);
    };

    const showFeedback = (message, type = 'success') => {
      if (!feedbackEl) return;
      feedbackEl.textContent = message;
      feedbackEl.hidden = false;
      feedbackEl.dataset.variantFeedback = type;
      global.clearTimeout(feedbackEl._timeout);
      feedbackEl._timeout = global.setTimeout(() => {
        feedbackEl.hidden = true;
      }, 2800);
    };

    const addVariantToCart = (variant, { goToCart = false } = {}) => {
      if (!variant || !product) return;
      const variantId = buildVariantId(product, variant);
      const existingIndex = cartItems.findIndex((item) => normalizeId(item.id) === variantId);

      if (existingIndex >= 0) {
        const existing = { ...cartItems[existingIndex] };
        existing.quantidade = coerceQuantity((Number(existing.quantidade) || 1) + 1, 99);
        cartItems[existingIndex] = existing;
      } else {
        cartItems.push({
          id: variantId,
          quantidade: 1,
          nome: `${product.nome} — ${variant.color} ${variant.size}`.trim(),
          preco: product.preco,
          imagem: product.imagem,
          categoria: product.categoria,
          tamanho: variant.size,
          cor: variant.color
        });
      }

      if (cartModule?.persist) {
        cartItems = cartModule.persist(cartItems, {
          origin: 'product-page',
          maxQuantity: 99
        });
      } else {
        cartItems = sanitizeItems(cartItems);
        global.localStorage?.setItem?.(cartModule?.STORAGE_KEY || 'mefit-cart-items', JSON.stringify(cartItems));
        global.dispatchEvent(
          new CustomEvent('cart:changed', {
            detail: {
              origin: 'product-page',
              items: cartItems.map((item) => ({ ...item }))
            }
          })
        );
      }

      updatePrimaryButtonState();
      showFeedback('Produto adicionado ao carrinho!');

      if (goToCart) {
        global.setTimeout(() => {
          global.location.href = './carrinho.html';
        }, 200);
      }
    };

    const initStickyBar = () => {
      if (!buyNowBar || !addToCartButton) return;
      if (typeof global.IntersectionObserver !== 'function') {
        buyNowBar.hidden = true;
        buyNowBar.classList.remove('is-visible');
        return;
      }
      const mediaQuery =
        typeof global.matchMedia === 'function' ? global.matchMedia('(max-width: 768px)') : null;

      const updateVisibility = (visible) => {
        if (!buyNowBar) return;
        if (!visible) {
          buyNowBar.classList.remove('is-visible');
          buyNowBar.hidden = true;
        } else {
          buyNowBar.hidden = false;
          buyNowBar.classList.add('is-visible');
        }
      };

      const observer = new IntersectionObserver(
        ([entry]) => {
          const isVisible = entry?.isIntersecting;
          const show = mediaQuery ? mediaQuery.matches && !isVisible : !isVisible;
          updateVisibility(show);
        },
        { threshold: 0.25 }
      );

      observer.observe(addToCartButton);

      const handleMediaChange = () => {
        if (!mediaQuery) return;
        if (!mediaQuery.matches) {
          updateVisibility(false);
        }
      };

      if (mediaQuery?.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else if (mediaQuery?.addListener) {
        mediaQuery.addListener(handleMediaChange);
      }

      buyNowBar.dataset.stickyReady = 'true';
    };

    const bindActions = () => {
      if (addToCartButton) {
        addToCartButton.addEventListener('click', () => {
          const variant = getSelectedVariant();
          if (!variant) return;
          addVariantToCart(variant, { goToCart: false });
        });
      }

      if (goToCartButton) {
        goToCartButton.addEventListener('click', () => {
          global.location.href = './carrinho.html';
        });
      }

      if (buyNowButton) {
        buyNowButton.addEventListener('click', () => {
          const variant = getSelectedVariant();
          if (!variant) return;
          addVariantToCart(variant, { goToCart: true });
        });
      }
    };

    const hydrateUI = () => {
      if (!product || !layout) return;
      if (imageEl) {
        imageEl.src = product.imagem;
        imageEl.alt = product.nome;
      }
      if (nameEl) nameEl.textContent = product.nome;
      if (descriptionEl) descriptionEl.textContent = product.descricao || '';
      if (breadcrumbEl) breadcrumbEl.textContent = product.nome;
      doc.title = `M.E FIT — ${product.nome}`;

      variants = generateVariants(product);
      if (!variants.length) {
        setVisibility(layout, false);
        setVisibility(emptyEl, true);
        return;
      }

      selectedColor = variants[0].color;
      selectedSize = variants[0].size;

      renderColorOptions();
      renderSizeOptions();
      updateProductView();
      bindActions();
      initStickyBar();

      setVisibility(layout, true);
      setVisibility(emptyEl, false);
      setVisibility(loadingEl, false);
    };

    const handleCartChange = () => {
      cartItems = cartModule?.load ? cartModule.load({ maxQuantity: 99 }) : cartItems;
      if (!cartItems.length && cartModule?.load == null) {
        const stored = global.localStorage?.getItem(cartModule?.STORAGE_KEY || 'mefit-cart-items');
        if (stored) {
          try {
            cartItems = JSON.parse(stored);
          } catch (error) {
            cartItems = [];
          }
        }
      }
      updatePrimaryButtonState();
    };

    global.addEventListener('cart:changed', handleCartChange);
    global.addEventListener('storage', (event) => {
      if (cartModule?.STORAGE_KEY && event.key && event.key !== cartModule.STORAGE_KEY) return;
      handleCartChange();
    });

    try {
      setVisibility(loadingEl, true);
      const response = await fetch(source, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Erro ao carregar produto: ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) throw new Error('Catálogo vazio.');

      const found = findProduct(data, { slug: requestedSlug, id: requestedId });
      if (!found && (requestedSlug || requestedId)) {
        if (breadcrumbEl) breadcrumbEl.textContent = 'Produto indisponível';
        setVisibility(loadingEl, false);
        setVisibility(emptyEl, true);
        return;
      }

      product = found || data[0];
      hydrateUI();
    } catch (error) {
      console.warn(error);
      if (breadcrumbEl) breadcrumbEl.textContent = 'Erro ao carregar produto';
      setVisibility(loadingEl, false);
      setVisibility(emptyEl, true);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
