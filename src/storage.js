/* Local, offline-first persistence.
 *
 * This replaces window.storage (a Claude-artifact-only, async API) with
 * localStorage, which is synchronous and available on every phone browser.
 * Everything is stored as JSON under a "wk-" prefix.
 */

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    /* first run, private mode, or corrupted value */
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
