// Check the entry page as well as its versioned assets when a saved app returns.
export function startAutoUpdates(isIdle) {
  const selector = 'script[src], link[rel="stylesheet"]';
  const signature = page => [...page.querySelectorAll(selector)]
    .map(node => node.getAttribute('src') || node.getAttribute('href')).join('\n');
  const current = signature(document);
  let checking = false, pending = null, reloading = false;

  function applyPending() {
    if (!pending || reloading || document.hidden || !isIdle()) return;
    reloading = true;
    location.replace(pending);
  }

  async function check() {
    if (checking || reloading || document.hidden) return;
    checking = true;
    try {
      const url = new URL(location.href);
      // A fresh URL also avoids an old entry page in an intermediary cache.
      url.searchParams.set('_update', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return;
      const latest = new DOMParser().parseFromString(await response.text(), 'text/html');
      // Ignore error pages or responses that are not this application.
      if (!latest.querySelector('#start') || !latest.querySelector('script[type="module"][src*="app.js"]')) return;
      if (signature(latest) !== current) {
        pending = url.href;
        applyPending();
      }
    } catch {
      // Offline or failed checks leave the running application usable.
    } finally {
      checking = false;
    }
  }

  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { applyPending(); check(); }
  });
  check();
  return { applyPending };
}
