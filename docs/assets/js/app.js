(() => {
  const global = window.MEFIT ?? (window.MEFIT = {});
  const readyCallbacks = [];

  const ready = global.ready || ((callback) => {
    if (typeof callback !== 'function') return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  });

  const updateYear = () => {
    const targets = document.querySelectorAll('#year, [data-current-year]');
    if (!targets.length) return;

    const currentYear = String(new Date().getFullYear());
    targets.forEach((element) => {
      element.textContent = currentYear;
    });
  };

  global.onReady = (callback) => {
    if (typeof callback !== 'function') return;

    if (document.documentElement.dataset.mefitReady === 'true') {
      callback();
      return;
    }

    readyCallbacks.push(callback);
  };

  global.ready = ready;

  const bootstrap = () => {
    if (document.documentElement.dataset.mefitReady === 'true') {
      return;
    }

    document.documentElement.dataset.mefitReady = 'true';
    updateYear();

    readyCallbacks.splice(0).forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('MEFIT ready callback failed:', error);
      }
    });

    document.dispatchEvent(new CustomEvent('mefit:ready'));
  };

  ready(bootstrap);
})();
