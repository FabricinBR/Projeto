document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  initSearchEngine();
});

function initSearchEngine() {
  const searchRoot = document.querySelector('[data-search]');
  if (!searchRoot) return;

  const input = searchRoot.querySelector('[data-search-input]');
  const form = searchRoot.querySelector('[data-search-form]');
  const resultsList = searchRoot.querySelector('[data-search-results]');
  const emptyState = searchRoot.querySelector('[data-search-empty]');
  const counter = searchRoot.querySelector('[data-search-count]');

  if (!input || !form || !resultsList || !emptyState || !counter) return;

  const normalize = (value = '') => String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const escapeHTML = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const catalog = [
    {
      code: 'ME-1001',
      name: 'Legging Aurora',
      description: 'Cintura alta com sustentação gradual e proteção UV50+. Destaque da vitrine de lançamentos.',
      tags: ['legging', 'lançamento', 'aurora'],
      url: './produtos.html'
    },
    {
      code: 'ME-1010',
      name: 'Top Horizon',
      description: 'Top estruturado com recortes ergonômicos ideal para treinos intensos.',
      tags: ['top', 'horizon', 'treinos intensos'],
      url: './produtos.html'
    },
    {
      code: 'ME-1042',
      name: 'Jaqueta Boreal',
      description: 'Jaqueta corta-vento respirável com proteção contra chuva leve.',
      tags: ['jaqueta', 'boreal', 'resistente à água'],
      url: './produtos.html'
    },
    {
      code: 'KIT-200',
      name: 'Power Duo',
      description: 'Combo com top estruturado e legging compressiva com 15% off.',
      tags: ['combo', 'power duo', 'kit exclusivo'],
      url: './produtos.html'
    },
    {
      code: 'KIT-210',
      name: 'Flow Pack',
      description: 'Camiseta dry + short leve com frete grátis para todo o Brasil.',
      tags: ['combo', 'flow pack', 'yoga'],
      url: './produtos.html'
    },
    {
      code: 'KIT-260',
      name: 'Outdoor Pro',
      description: 'Kit com jaqueta corta-vento e calça repelente com ajuste térmico.',
      tags: ['combo', 'outdoor', 'trilha'],
      url: './produtos.html'
    },
    {
      code: 'ME-1100',
      name: 'Legging Tech',
      description: 'Peça catálogo com tecido tecnológico e compressão estratégica.',
      tags: ['legging', 'catálogo', 'tech'],
      url: './produtos.html'
    },
    {
      code: 'ME-1115',
      name: 'Top Performance',
      description: 'Top com suporte médio e alças reguláveis para treinos variados.',
      tags: ['top', 'performance'],
      url: './produtos.html'
    },
    {
      code: 'ME-1150',
      name: 'Camiseta Dry',
      description: 'Camiseta de secagem rápida com recortes respiráveis.',
      tags: ['camiseta', 'dry fit'],
      url: './produtos.html'
    }
  ].map((item) => ({
    ...item,
    tokens: normalize(`${item.code} ${item.name} ${item.tags.join(' ')}`)
  }));

  const renderResults = (items) => {
    resultsList.innerHTML = items.map((item) => `
      <li class="search-result">
        <a href="${item.url}">
          <span class="search-code">${item.code}</span>
          <p class="search-name">${item.name}</p>
          <p class="search-description">${item.description}</p>
          <ul class="search-tags">
            ${item.tags.map((tag) => `<li class="search-tag">${tag}</li>`).join('')}
          </ul>
        </a>
      </li>
    `).join('');
  };

  const updateState = (items, normalizedQuery, rawQuery) => {
    const cleanQuery = rawQuery.trim();
    const queryForDisplay = escapeHTML(cleanQuery);
    const hasQuery = normalizedQuery.length > 0;
    const hasResults = items.length > 0;
    resultsList.classList.toggle('is-hidden', !hasResults);
    emptyState.classList.toggle('is-hidden', hasResults);
    if (hasResults) {
      counter.textContent = hasQuery
        ? `${items.length} ${items.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} para “${cleanQuery}”`
        : `Mostrando todos os ${items.length} produtos cadastrados`;
      emptyState.textContent = 'Nenhum produto encontrado com esses termos. Tente buscar pelo código completo ou por outra palavra-chave.';
    } else {
      counter.textContent = hasQuery
        ? `Nenhum resultado para “${cleanQuery}”`
        : 'Nenhum produto cadastrado';
      emptyState.innerHTML = hasQuery
        ? `Nenhum produto encontrado para <strong>“${queryForDisplay}”</strong>. Tente buscar pelo código completo ou por outra palavra-chave.`
        : 'Nenhum produto cadastrado no momento.';
    }
  };

  const performSearch = (query) => {
    const normalizedQuery = normalize(query);
    const results = normalizedQuery
      ? catalog.filter((item) => item.tokens.includes(normalizedQuery))
      : catalog;

    renderResults(results);
    updateState(results, normalizedQuery, query);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    performSearch(input.value);
    input.focus();
  });

  input.addEventListener('input', () => {
    performSearch(input.value);
  });

    renderResults(catalog);
    updateState(catalog, '', '');
  }
