/*
 * Chooses the colour scheme before first paint (this file is loaded from <head>, so the page never flashes the
 * wrong palette). The preference is 'auto' (follow the system), 'dark' or 'light'.
 * ?scheme=light|dark overrides it without saving it, handy for screenshots.
 */
(function (root) {
  'use strict';

  const KEY = 'intime.scheme';
  const system = root.matchMedia('(prefers-color-scheme: light)');

  function readPreference() {
    const forced = new URLSearchParams(root.location.search).get('scheme');
    if (forced === 'light' || forced === 'dark') return forced;
    try {
      const saved = root.localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* storage blocked: stay on auto */ }
    return 'auto';
  }

  function savePreference(pref) {
    try {
      if (pref === 'auto') root.localStorage.removeItem(KEY);
      else root.localStorage.setItem(KEY, pref);
    } catch { /* storage blocked: the choice just won't persist */ }
  }

  /** Sets <html data-scheme> for a preference and returns the scheme it resolved to. */
  function apply(pref) {
    const scheme = pref === 'auto' ? (system.matches ? 'light' : 'dark') : pref;
    root.document.documentElement.dataset.scheme = scheme;
    return scheme;
  }

  root.InTimeScheme = { system, readPreference, savePreference, apply };
  apply(readPreference());
})(window);
