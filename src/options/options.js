// MetaGroove Options Page

(function() {
  'use strict';

  // i18n Helper
  const t = (key) => chrome.i18n.getMessage(key) || key;

  // Storage Helper (Cross-browser)
  const storage = {
    get: (keys) => new Promise((resolve) => {
      try {
        if (chrome.storage.local.get.length === 0) { // MV3 Promise check? No reliable way
           const p = chrome.storage.local.get(keys);
           if (p && typeof p.then === 'function') { p.then(resolve); return; }
        }
      } catch(e){}
      chrome.storage.local.get(keys, (r) => resolve(r || {}));
    }),
    set: (items) => new Promise((resolve) => {
      try {
        const p = chrome.storage.local.set(items);
        if (p && typeof p.then === 'function') { p.then(() => resolve(true)); return; }
      } catch(e){}
      chrome.storage.local.set(items, () => resolve(true));
    })
  };
  
  // Apply i18n to all elements with data-i18n attributes
  function applyI18n() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    
    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    
    // Titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
  }

  // Elementi DOM
  const elements = {
    successMessage: document.getElementById('successMessage'),
    
    // Piattaforme
    platformSoundCloud: document.getElementById('platformSoundCloud'),
    platformYouTube: document.getElementById('platformYouTube'),
    platformYouTubeMusic: document.getElementById('platformYouTubeMusic'),

    // Interface
    showVerifiedYear: document.getElementById('showVerifiedYear'),
    explorationMode: document.getElementById('explorationMode'),

    // API Key
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    removeApiKeyBtn: document.getElementById('removeApiKeyBtn'),
    
    // Cache
    cacheCount: document.getElementById('cacheCount'),
    cacheSize: document.getElementById('cacheSize'),
    refreshCacheStatsBtn: document.getElementById('refreshCacheStatsBtn'),
    clearCacheBtn: document.getElementById('clearCacheBtn')
  };

  // === Inizializzazione ===
  
  async function init() {
    try {
      applyI18n();
      await loadGlobalSettings();
      await loadAPIKey();
      await loadCacheStats();
      setupEventListeners();
    } catch (error) {
      console.error('Errore inizializzazione options:', error);
      showMessage(t('optionsErrorLoading') || 'Errore caricamento impostazioni', 'error');
    }
  }

  // === Event Listeners ===
  
  function setupEventListeners() {
    elements.platformSoundCloud.addEventListener('change', saveGlobalSettings);
    elements.platformYouTube.addEventListener('change', saveGlobalSettings);
    elements.platformYouTubeMusic.addEventListener('change', saveGlobalSettings);
    
    if (elements.showVerifiedYear) {
      elements.showVerifiedYear.addEventListener('change', saveGlobalSettings);
    }
    if (elements.explorationMode) {
      elements.explorationMode.addEventListener('change', saveGlobalSettings);
    }

    elements.saveApiKeyBtn.addEventListener('click', saveAPIKey);
    elements.removeApiKeyBtn.addEventListener('click', removeAPIKey);
    elements.refreshCacheStatsBtn.addEventListener('click', loadCacheStats);
    elements.clearCacheBtn.addEventListener('click', clearCache);
  }

  // === Impo Globali ===

  async function loadGlobalSettings() {
    try {
      const result = await storage.get(['metagroove_platforms', 'metagroove_options']);
      
      const platforms = result.metagroove_platforms || {
        soundcloud: true,
        youtube: true,
        youtube_music: false 
      };
      
      const options = result.metagroove_options || {
        showVerifiedYear: true,
        explorationMode: false
      };
      
      elements.platformSoundCloud.checked = platforms.soundcloud;
      elements.platformYouTube.checked = platforms.youtube;
      elements.platformYouTubeMusic.checked = platforms.youtube_music;
      
      if (elements.showVerifiedYear) {
        elements.showVerifiedYear.checked = options.showVerifiedYear;
      }
      if (elements.explorationMode) {
        elements.explorationMode.checked = options.explorationMode || false;
      }
    } catch (error) {
      console.error('Errore caricamento impostazioni globali', error);
    }
  }

  async function saveGlobalSettings() {
    const platforms = {
      soundcloud: elements.platformSoundCloud.checked,
      youtube: elements.platformYouTube.checked,
      youtube_music: elements.platformYouTubeMusic.checked
    };
    
    const options = {
      showVerifiedYear: elements.showVerifiedYear ? elements.showVerifiedYear.checked : true,
      explorationMode: elements.explorationMode ? elements.explorationMode.checked : false
    };
    
    try {
      await storage.set({ 
        metagroove_platforms: platforms,
        metagroove_options: options 
      });
      // Force reload of active tabs to apply changes immediately? 
      // Not strictly necessary as content scripts react to storage changes or page reload.
    } catch (error) {
      console.error('Errore salvataggio', error);
      showMessage('Errore salvataggio', 'error');
    }
  }

  // === API Key ===
  
  async function loadAPIKey() {
    try {
      const response = await sendMessage({ action: 'getYouTubeAPIKey' });
      if (response?.success && response.apiKey) {
        elements.apiKeyInput.value = response.apiKey;
      }
    } catch (error) {
      console.error('Errore caricamento API key:', error);
    }
  }

  async function saveAPIKey() {
    try {
      const apiKey = elements.apiKeyInput.value.trim();
      
      if (!apiKey) {
        showMessage(t('optionsApiKeyInvalid') || 'Inserisci un\'API key valida', 'error');
        return;
      }

      elements.saveApiKeyBtn.disabled = true;
      elements.saveApiKeyBtn.textContent = t('optionsSaving') || 'Salvataggio...';

      const response = await sendMessage({ 
        action: 'setYouTubeAPIKey',
        apiKey: apiKey
      });

      if (response?.success) {
        showMessage(t('optionsApiKeySaved') || '✓ API Key salvata con successo!', 'success');
      } else {
        throw new Error(response?.error || t('optionsErrorSaving') || 'Errore salvataggio');
      }
    } catch (error) {
      console.error('Errore salvataggio API key:', error);
      showMessage((t('optionsErrorSavingApiKey') || 'Errore salvataggio API key') + ': ' + error.message, 'error');
    } finally {
      elements.saveApiKeyBtn.disabled = false;
      elements.saveApiKeyBtn.textContent = t('btnSaveApiKey') || 'Salva API Key';
    }
  }

  async function removeAPIKey() {
    try {
      const confirmed = confirm(t('optionsConfirmRemoveApiKey') || 'Vuoi davvero rimuovere l\'API key?\n\nL\'estensione userà solo fetch HTML gratuito.');
      if (!confirmed) return;

      elements.removeApiKeyBtn.disabled = true;
      elements.removeApiKeyBtn.textContent = t('optionsRemoving') || 'Rimozione...';

      const response = await sendMessage({ 
        action: 'setYouTubeAPIKey',
        apiKey: ''
      });

      if (response?.success) {
        elements.apiKeyInput.value = '';
        showMessage(t('optionsApiKeyRemoved') || '✓ API Key rimossa', 'success');
      } else {
        throw new Error(response?.error || t('optionsErrorRemoving') || 'Errore rimozione');
      }
    } catch (error) {
      console.error('Errore rimozione API key:', error);
      showMessage((t('optionsErrorRemovingApiKey') || 'Errore rimozione API key') + ': ' + error.message, 'error');
    } finally {
      elements.removeApiKeyBtn.disabled = false;
      elements.removeApiKeyBtn.textContent = t('btnRemoveApiKey') || 'Rimuovi API Key';
    }
  }

  // === Cache ===
  
  async function loadCacheStats() {
    try {
      elements.refreshCacheStatsBtn.disabled = true;
      elements.refreshCacheStatsBtn.textContent = t('loading') || 'Caricamento...';

      // Richiedi statistiche cache al service worker
      const response = await sendMessage({ action: 'getCacheStats' });

      if (response?.success) {
        const count = response.count || 0;
        const size = response.sizeBytes || 0;

        elements.cacheCount.textContent = count.toLocaleString();
        elements.cacheSize.textContent = formatBytes(size);
      } else {
        elements.cacheCount.textContent = '-';
        elements.cacheSize.textContent = '-';
      }
    } catch (error) {
      console.error('Errore caricamento statistiche cache:', error);
      elements.cacheCount.textContent = '?';
      elements.cacheSize.textContent = '?';
    } finally {
      elements.refreshCacheStatsBtn.disabled = false;
      elements.refreshCacheStatsBtn.textContent = t('btnRefreshStats') || '🔄 Aggiorna Statistiche';
    }
  }

  async function clearCache() {
    try {
      const confirmed = confirm(t('optionsConfirmClearCache') ||
        'Vuoi davvero pulire tutta la cache delle date video?\n\n' +
        'Questo forzerà il re-fetch di tutte le date dalla prossima visita.'
      );
      if (!confirmed) return;

      elements.clearCacheBtn.disabled = true;
      elements.clearCacheBtn.textContent = t('optionsClearing') || '🗑️ Pulizia...';

      const response = await sendMessage({ action: 'clearVideoDateCache' });

      if (response?.success) {
        showMessage(t('optionsCacheCleared') || '✓ Cache pulita con successo!', 'success');
        await loadCacheStats(); // Ricarica statistiche
      } else {
        throw new Error(response?.error || t('optionsErrorClearing') || 'Errore pulizia cache');
      }
    } catch (error) {
      console.error('Errore pulizia cache:', error);
      showMessage((t('optionsErrorClearingCache') || 'Errore pulizia cache') + ': ' + error.message, 'error');
    } finally {
      elements.clearCacheBtn.disabled = false;
      elements.clearCacheBtn.textContent = t('btnClearCache') || '🗑️ Pulisci Tutta la Cache';
    }
  }

  // === UI Helpers ===
  
  function showMessage(message, type = 'success') {
    elements.successMessage.textContent = message;
    elements.successMessage.className = 'success-message show';
    elements.successMessage.style.background = type === 'error' ? '#ef4444' : '#10b981';

    setTimeout(() => {
      elements.successMessage.classList.remove('show');
    }, 4000);
  }

  function formatBytes(bytes) {
    if (bytes <= 2) return 'Vuota (0 B)'; // 2 bytes = "{}" empty JSON
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // === Communication ===
  
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(response);
      });
    });
  }

  // Start
  init();
})();
