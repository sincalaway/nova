(function (root) {
  'use strict';

  const STORAGE_KEY = 'suishun.ui.footer-hidden.v1';

  function init() {
    const footer = document.querySelector('#chromeFoot');
    const hideButton = document.querySelector('#footerToggle');
    const restoreButton = document.querySelector('#footerRestore');
    if (!footer || !hideButton || !restoreButton || footer.dataset.toggleReady) return;
    footer.dataset.toggleReady = 'true';

    function setHidden(hidden, persist = false) {
      footer.hidden = hidden;
      restoreButton.hidden = !hidden;
      document.body.classList.toggle('footer-hidden', hidden);
      hideButton.setAttribute('aria-expanded', String(!hidden));
      if (persist) {
        try { localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0'); } catch (_) {}
      }
    }

    let initiallyHidden = false;
    try { initiallyHidden = localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) {}
    setHidden(initiallyHidden);
    hideButton.addEventListener('click', () => setHidden(true, true));
    restoreButton.addEventListener('click', () => {
      setHidden(false, true);
      hideButton.focus();
    });
    root.NovaFooterToggle = { init, show: () => setHidden(false, true), hide: () => setHidden(true, true) };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  root.NovaFooterToggle = root.NovaFooterToggle || { init };
})(window);
