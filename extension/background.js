// activeTab grants access only to the tab the user explicitly clicked from.
chrome.action.onClicked.addListener((tab) => {
  const params = new URLSearchParams();
  const currentUrl = typeof tab.url === 'string' ? tab.url : '';
  let parsed;

  try {
    parsed = new URL(currentUrl);
  } catch {
    parsed = null;
  }

  if (parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
    params.set('addUrl', parsed.href);
    params.set('addTitle', tab.title || parsed.hostname);
  } else {
    params.set('addError', 'unsupported');
  }

  const query = params.toString();
  const target = chrome.runtime.getURL(`newtab.html${query ? `?${query}` : ''}`);
  chrome.tabs.create({ url: target, active: true });
});
