// MetaGroove About Page Script

(function() {
  'use strict';

  // i18n Helper
  const t = (key) => {
    const msg = chrome.i18n.getMessage(key);
    return msg || key;
  };

  /**
   * Apply i18n to all elements with data-i18n attributes
   * Supports: data-i18n, data-i18n-placeholder, data-i18n-title, data-i18n-html
   */
  function applyI18n() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = t(key);
    });
    
    // HTML content
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const key = element.getAttribute('data-i18n-html');
      const html = t(key);
      // Use DOMParser to avoid "Unsafe assignment to innerHTML" warning
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      element.replaceChildren(...doc.body.childNodes);
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = t(key);
    });
    
    // Titles
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = t(key);
    });
  }

  // Update dynamic elements
  function updateDynamicContent() {
    const versionEl = document.getElementById('version');
    if (versionEl) {
      const manifest = chrome.runtime.getManifest();
      versionEl.textContent = `v${manifest.version}`;
    }
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    applyI18n();
    updateDynamicContent();
  });

})();
