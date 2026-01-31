/**
 * MetaGroove i18n Helper
 * Wrapper for chrome.i18n.getMessage with automatic DOM binding
 */

/**
 * Get translated message
 */
export function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * Apply i18n to all elements with data-i18n attributes
 * Supports: data-i18n, data-i18n-placeholder, data-i18n-title
 */
export function applyI18n() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
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