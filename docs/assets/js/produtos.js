const ready = (callback) => {
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

  const formatCurrency = (value) => value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

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
    const categories = Array.from(new Set(allProducts.map((product) => product.categoria)))
      .sort((a, b) => a.localeCompare(b));
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Todas as categorias</option>'
        + categories.map((category) => `<option value="${category}">${category}</option>`).join('');
    }

    const sizes = Array.from(new Set(allProducts.flatMap((product) => (
      Array.isArray(product.tamanhos) ? product.tamanhos : []
    )))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (sizeSelect) {
      sizeSelect.innerHTML = '<option value="">Todos os tamanhos</option>'
        + sizes.map((size) => `<option value="${size}">${size}</option>`).join('');
    }

    const prices = allProducts
      .map((product) => Number(product.preco))
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
};

document.addEventListener('mefit:ready', initProducts);
ready(initProducts);
