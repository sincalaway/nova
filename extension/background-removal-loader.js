(function (root) {
  'use strict';
  let enginePromise;
  root.NovaLoadBackgroundEngine = () => {
    if (!enginePromise) enginePromise = import('./background-removal.bundle.js').catch(error => {
      enginePromise = null;
      throw new Error(error?.message || '本地去背模块加载失败。');
    });
    return enginePromise;
  };
})(window);
