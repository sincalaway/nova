(function (root) {
  'use strict';
  const DB_NAME = 'nova-local-assets';
  const STORE = 'media';
  function openDb() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('当前浏览器不支持 IndexedDB'));
      const request = root.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('打开本地媒体库失败'));
    });
  }
  async function withStore(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let request;
      try { request = fn(store); } catch (error) { db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(request && request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || request?.error || new Error('本地媒体操作失败')); };
    });
  }
  root.NovaAssets = {
    put: (key, blob) => withStore('readwrite', store => store.put(blob, key)),
    get: key => withStore('readonly', store => store.get(key)),
    delete: key => withStore('readwrite', store => store.delete(key))
  };
})(typeof window !== 'undefined' ? window : globalThis);
