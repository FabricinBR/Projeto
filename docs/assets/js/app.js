const ready = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
};

const updateYear = () => {
  const targets = document.querySelectorAll('#year, [data-current-year]');
  if (!targets.length) return;

  const currentYear = String(new Date().getFullYear());
  targets.forEach((element) => {
    element.textContent = currentYear;
  });
};

const bootstrap = () => {
  updateYear();

  if (document.documentElement.dataset.mefitReady === 'true') {
    return;
  }

  document.documentElement.dataset.mefitReady = 'true';
  document.dispatchEvent(new CustomEvent('mefit:ready'));
};

ready(bootstrap);
