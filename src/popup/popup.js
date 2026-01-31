// MetaGroove Popup - Simplified & Functional

(function() {
  'use strict';

  // i18n Helper
  const t = (key) => {
    const msg = chrome.i18n.getMessage(key);
    return msg || key;
  };

  // Tabs Helper (Cross-browser)
  const tabsQuery = (queryInfo) => new Promise((resolve) => {
    try {
      chrome.tabs.query(queryInfo, (result) => {
        if (chrome.runtime.lastError) {
             console.warn('Tabs query error:', chrome.runtime.lastError);
             resolve([]);
        } else {
             resolve(result || []);
        }
      });
    } catch (e) {
      console.error('Tabs query exception:', e);
      resolve([]);
    }
  });
  
  // Apply i18n to all elements
  function applyI18n() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = t(key);
      el.textContent = translation;
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

  // DOM Elements
  const elements = {
    loading: document.getElementById('loading'),
    app: document.getElementById('app'),
    error: document.getElementById('error'),
    platformStatus: document.getElementById('platformStatus'),
    toggleBtn: document.getElementById('toggleBtn'),
    toggleText: document.getElementById('toggleText'),
    applyBtn: document.getElementById('applyBtn'),
    infoIcon: document.getElementById('infoIcon'),
    settingsIcon: document.getElementById('settingsIcon'),
    
    // Existing Filters
    yearFilter: document.getElementById('yearFilter'),
    minYear: document.getElementById('minYear'),
    maxYear: document.getElementById('maxYear'),
    showUnknownYear: document.getElementById('showUnknownYear'),
    
    durationFilter: document.getElementById('durationFilter'),
    minDuration: document.getElementById('minDuration'),
    maxDuration: document.getElementById('maxDuration'),
    durationDisplay: document.getElementById('durationDisplay'),
    
    genreFilter: document.getElementById('genreFilter'),
    genreInput: document.getElementById('genreInput'),
    
    // New Filters
    blacklistFilter: document.getElementById('blacklistFilter'),
    blacklistInput: document.getElementById('blacklistInput'),
    
    // Youtube only
    explorationModeGroup: document.getElementById('explorationModeGroup'),
    explorationMode: document.getElementById('explorationMode'),

    // Visual Options
    showVerifiedYear: document.getElementById('showVerifiedYear'),

    // SoundCloud only
    hashtagsGroup: document.getElementById('hashtagsGroup'),
    hashtagsFilter: document.getElementById('hashtagsFilter'),
    hashtagsInput: document.getElementById('hashtagsInput'),
    hashtagsMode: document.getElementById('hashtagsMode'),
  };

  // State
  let activeTab = null;
  let settings = null;
  let platforms = null;

  // Initialization
  async function init() {
    try {
      showLoading(true);
      
      applyI18n();

      // Load Platform Settings
      platforms = await new Promise(resolve => {
        chrome.storage.local.get('metagroove_platforms', (result) => {
          resolve(result.metagroove_platforms || {
            soundcloud: true,
            youtube: true,
            youtube_music: false // Default disable
          });
        });
      });
      
      // Get active tab safely (Firefox strict mode compat)
      let tabs = await tabsQuery({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        // Fallback: Try without currentWindow constraint
        tabs = await tabsQuery({ active: true });
      }
      
      if (!tabs || tabs.length === 0) {
        console.warn('MetaGroove: No active tab found');
        showError('No active tab detected');
        showLoading(false);
        return;
      }
      
      activeTab = tabs[0];
      
      if (!activeTab || !activeTab.id) {
         throw new Error('Invalid tab ID');
      }

      updatePlatformStatus();

      // Check if globally disabled
      if (isPlatformGloballyDisabled()) {
        showGlobalDisabledMessage();
        showLoading(false);
        setupEventListeners(); // Setup minimal listeners (icons)
        return;
      }
      
      // Load Settings
      const response = await sendMessage({ 
        action: 'getTabSettings', 
        tabId: activeTab.id 
      });
      
      if (response && response.success) {
        settings = response.settings;
        populateUI();
        setupEventListeners();
        showLoading(false);
      } else {
        throw new Error(response?.error || 'Error loading settings');
      }
    } catch (error) {
      console.error('MetaGroove Init Error:', error);
      showError(error.message || 'Initialization failed');
      showLoading(false);
    }
  }

  // Populate UI
  function populateUI() {
    if (!settings) return;

    // Main Toggle
    updateToggleButton(settings.enabled);
    
    // Year Filter
    elements.yearFilter.checked = settings.filters.year.enabled;
    elements.minYear.value = settings.filters.year.min || 2010;
    elements.maxYear.value = settings.filters.year.max || new Date().getFullYear();
    elements.minYear.disabled = !settings.filters.year.enabled;
    elements.maxYear.disabled = !settings.filters.year.enabled;
    elements.showUnknownYear.checked = settings.filters.year.showUnknownYear ?? false;
    elements.showUnknownYear.disabled = !settings.filters.year.enabled;
    
    // Duration Filter
    elements.durationFilter.checked = settings.filters.duration.enabled;
    elements.minDuration.value = settings.filters.duration.min || 0;
    elements.maxDuration.value = settings.filters.duration.max || 1800;
    elements.minDuration.disabled = !settings.filters.duration.enabled;
    elements.maxDuration.disabled = !settings.filters.duration.enabled;
    updateDurationDisplay();
    
    // Exploration Mode (Note: handled gracefully if missing from defaults)
    if (elements.explorationMode) {
      elements.explorationMode.checked = settings.filters.explorationMode?.enabled || false;
    }

    // Visual Options
    if (elements.showVerifiedYear) {
      // Default to true if undefined (as requested by user)
      elements.showVerifiedYear.checked = (settings.options?.showVerifiedYear !== undefined) ? settings.options.showVerifiedYear : true;
    }

    // Genre/Search Filter
    elements.genreFilter.checked = settings.filters.genre.enabled;
    elements.genreInput.value = settings.filters.genre.value || '';
    elements.genreInput.disabled = !settings.filters.genre.enabled;
    
    // Blacklist Filter
    if (settings.filters.blacklist) {
      elements.blacklistFilter.checked = settings.filters.blacklist.enabled || false;
      elements.blacklistInput.value = settings.filters.blacklist.keywords || '';
      elements.blacklistInput.disabled = !settings.filters.blacklist.enabled;
    }
    
    // SoundCloud filters
    if (settings.filters.hashtags) {
      elements.hashtagsFilter.checked = settings.filters.hashtags.enabled || false;
      elements.hashtagsInput.value = settings.filters.hashtags.tags || '';
      elements.hashtagsMode.value = settings.filters.hashtags.matchMode || 'any';
      elements.hashtagsInput.disabled = !settings.filters.hashtags.enabled;
      elements.hashtagsMode.disabled = !settings.filters.hashtags.enabled;
    }

  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Main Toggle
    elements.toggleBtn.addEventListener('click', handleToggle);
    
    // Filter Checkboxes
    elements.yearFilter.addEventListener('change', (e) => {
      elements.minYear.disabled = !e.target.checked;
      elements.maxYear.disabled = !e.target.checked;
      elements.showUnknownYear.disabled = !e.target.checked;
    });
    
    elements.durationFilter.addEventListener('change', (e) => {
      elements.minDuration.disabled = !e.target.checked;
      elements.maxDuration.disabled = !e.target.checked;
    });
    
    elements.genreFilter.addEventListener('change', (e) => {
      elements.genreInput.disabled = !e.target.checked;
    });
    
    elements.blacklistFilter.addEventListener('change', (e) => {
      elements.blacklistInput.disabled = !e.target.checked;
    });
    
    // SoundCloud filters
    if (elements.hashtagsFilter) {
      elements.hashtagsFilter.addEventListener('change', (e) => {
        elements.hashtagsInput.disabled = !e.target.checked;
        elements.hashtagsMode.disabled = !e.target.checked;
      });
    }
    
    // Duration Sliders
    elements.minDuration.addEventListener('input', updateDurationDisplay);
    elements.maxDuration.addEventListener('input', updateDurationDisplay);
    
    // Year Validation
    elements.minYear.addEventListener('input', validateYearInputs);
    elements.maxYear.addEventListener('input', validateYearInputs);
    
    // Apply Button
    elements.applyBtn.addEventListener('click', applySettings);
    
    // Icons
    elements.infoIcon.addEventListener('click', openAbout);
    elements.settingsIcon.addEventListener('click', openSettings);
  }

  // Handlers
  function handleToggle() {
    if (!settings) return;
    settings.enabled = !settings.enabled;
    updateToggleButton(settings.enabled);
    applySettings();
  }

  async function applySettings() {
    try {
      elements.applyBtn.disabled = true;
      elements.applyBtn.textContent = t('btnApplying');
      
      collectSettings();
      
      if (!validateSettings()) {
        throw new Error('Invalid settings');
      }
      
      const response = await sendMessage({
        action: 'setTabSettings',
        tabId: activeTab.id,
        settings: settings
      });
      
      if (response && response.success) {
        setTimeout(() => window.close(), 500);
      } else {
        throw new Error(response?.error || 'Save failed');
      }
    } catch (error) {
      console.error('Apply Settings Error:', error);
      showError(error.message);
      elements.applyBtn.disabled = false;
      elements.applyBtn.textContent = t('btnApplyFilters');
    }
  }

  function collectSettings() {
    if (!settings) return;
    
    // Year
    settings.filters.year.enabled = elements.yearFilter.checked;
    settings.filters.year.min = parseInt(elements.minYear.value) || 2010;
    settings.filters.year.max = parseInt(elements.maxYear.value) || new Date().getFullYear();
    settings.filters.year.showUnknownYear = elements.showUnknownYear.checked;
    
    // Duration
    settings.filters.duration.enabled = elements.durationFilter.checked;
    settings.filters.duration.min = parseInt(elements.minDuration.value) || 0;
    settings.filters.duration.max = parseInt(elements.maxDuration.value) || 1800;
    
    // Exploration Mode
    if (!settings.filters.explorationMode) settings.filters.explorationMode = { enabled: false };
    if (elements.explorationMode) {
      settings.filters.explorationMode.enabled = elements.explorationMode.checked;
    }

    // Visual Options
    if (!settings.options) settings.options = {};
    if (elements.showVerifiedYear) {
      settings.options.showVerifiedYear = elements.showVerifiedYear.checked;
    }

    // Genre
    settings.filters.genre.enabled = elements.genreFilter.checked;
    settings.filters.genre.value = elements.genreInput.value.trim().toLowerCase();
    
    // Blacklist
    if (settings.filters.blacklist) {
      settings.filters.blacklist.enabled = elements.blacklistFilter.checked;
      settings.filters.blacklist.keywords = elements.blacklistInput.value.trim().toLowerCase();
    }
    
    // Hashtags
    if (settings.filters.hashtags) {
      settings.filters.hashtags.enabled = elements.hashtagsFilter.checked;
      settings.filters.hashtags.tags = elements.hashtagsInput.value.trim().toLowerCase();
      settings.filters.hashtags.matchMode = elements.hashtagsMode.value;
    }

  }

  function validateSettings() {
    if (settings.filters.year.enabled) {
      const minYear = settings.filters.year.min;
      const maxYear = settings.filters.year.max;
      
      if (minYear < 1950 || maxYear > 2030) {
        showError(t('errorInvalidYear'));
        return false;
      }
      
      if (minYear > maxYear) {
        showError(t('errorYearRange'));
        return false;
      }
    }
    
    if (settings.filters.duration.enabled) {
      const minDur = settings.filters.duration.min;
      const maxDur = settings.filters.duration.max;
      
      if (minDur > maxDur) {
        showError(t('errorDurationRange'));
        return false;
      }
    }
    
    return true;
  }

  // UI Helpers
  function updateToggleButton(enabled) {
    elements.toggleBtn.classList.toggle('enabled', enabled);
    elements.toggleText.textContent = enabled ? t('btnEnabled') + ' ✓' : t('btnDisabled');
  }

  function updateDurationDisplay() {
    const min = parseInt(elements.minDuration.value);
    const max = parseInt(elements.maxDuration.value);
    elements.durationDisplay.textContent = `${formatDuration(min)} - ${formatDuration(max)}`;
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins} min`;
  }

  function validateYearInputs() {
    const min = parseInt(elements.minYear.value);
    const max = parseInt(elements.maxYear.value);
    
    if (min && max && min > max) {
      elements.minYear.setCustomValidity(t('errorYearRange'));
    } else {
      elements.minYear.setCustomValidity('');
      elements.maxYear.setCustomValidity('');
    }
  }

  function updatePlatformStatus() {
    const url = activeTab.url;
    let platform = t('platformUnsupported');
    let isSoundCloud = false;
    let isYouTubeMusic = false;
    let isYouTube = false;
    
    if (url.includes('music.youtube.com')) {
      platform = t('platformYouTubeMusic');
      isYouTubeMusic = true;
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      platform = t('platformYouTube');
      isYouTube = true;
    } else if (url.includes('soundcloud.com')) {
      platform = t('platformSoundCloud');
      isSoundCloud = true;
    }
    
    elements.platformStatus.textContent = platform;
    
    // Show/Hide specific filters
    if (elements.hashtagsGroup) elements.hashtagsGroup.style.display = isSoundCloud ? 'block' : 'none';
    if (elements.explorationModeGroup) elements.explorationModeGroup.style.display = isYouTube ? 'block' : 'none';
  }

  function isPlatformGloballyDisabled() {
    const url = activeTab.url;
    if (url.includes('music.youtube.com')) return !platforms.youtube_music;
    if (url.includes('youtube.com') || url.includes('youtu.be')) return !platforms.youtube;
    if (url.includes('soundcloud.com')) return !platforms.soundcloud;
    return false;
  }

  function showGlobalDisabledMessage() {
    // Disable main toggle
    elements.toggleBtn.classList.remove('enabled');
    elements.toggleText.textContent = t('btnDisabled');
    elements.toggleBtn.style.opacity = '0.5';
    elements.toggleBtn.style.cursor = 'not-allowed';
    
    // Disable apply button
    elements.applyBtn.disabled = true;
    
    // Show warning in error box (styled differently)
    elements.error.textContent = t('msgPlatformDisabled') || 'Platform disabled in options';
    elements.error.classList.remove('hidden');
    elements.error.style.background = '#f59e0b'; // Amber warning color
    
    // Disable interactions
    elements.toggleBtn.style.pointerEvents = 'none';

    // Disable inputs
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => input.disabled = true);
  }

  function showLoading(show) {
    elements.loading.classList.toggle('hidden', !show);
    elements.app.classList.toggle('hidden', show);
  }

  function showError(message) {
    elements.error.textContent = message;
    elements.error.classList.remove('hidden');
    setTimeout(() => {
      elements.error.classList.add('hidden');
    }, 5000);
  }

  // Communication
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

  // === Navigation ===
  
  function openAbout() {
    // Webpack copies 'src/about' to 'about', so the built path is 'about/about.html'
    chrome.tabs.create({ url: chrome.runtime.getURL('about/about.html') });
  }
  
  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  // Start
  init();
})();
