// MetaGroove Service Worker - Simplified Version

'use strict';

const STORAGE_KEY = 'metagroove_tab_settings';
const VIDEO_DATE_CACHE_KEY = 'metagroove_video_dates';
const API_KEY_STORAGE = 'metagroove_youtube_api_key';

// Cache TTL: 7 days (video dates do not change)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// === Cross-Browser Storage Helpers ===
const storage = {
  get: (keys) => new Promise((resolve) => {
    // Check if chrome.storage.local.get returns a promise (MV3 / Browser API)
    try {
      const result = chrome.storage.local.get(keys);
      if (result && typeof result.then === 'function') {
        result.then(resolve);
        return;
      }
    } catch (e) { /* ignore error, fallback to callback */ }
    
    // Fallback to callback (Firefox MV2 via chrome namespace / Chrome MV2)
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Storage get error:', chrome.runtime.lastError);
        resolve({});
      } else {
        resolve(result || {});
      }
    });
  }),
  
  set: (items) => new Promise((resolve) => {
    try {
      const result = chrome.storage.local.set(items);
      if (result && typeof result.then === 'function') {
        result.then(() => resolve(true));
        return;
      }
    } catch (e) { /* ignore */ }
    
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage set error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  }),
  
  remove: (keys) => new Promise((resolve) => {
    try {
      const result = chrome.storage.local.remove(keys);
      if (result && typeof result.then === 'function') {
        result.then(() => resolve(true));
        return;
      }
    } catch (e) { /* ignore */ }
    
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage remove error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  })
};

const DEFAULT_SETTINGS = {
  enabled: true,
  options: {
    showVerifiedYear: true
  },
  filters: {
    explorationMode: { enabled: false }, // New Exploration Mode
    genre: { enabled: false, value: '' },
    year: { enabled: false, min: 2010, max: 2025, showUnknownYear: false },
    duration: { enabled: false, min: 0, max: 1800 },
    tags: { enabled: false, values: [] },
    blacklist: { enabled: false, keywords: '' },
    hashtags: { enabled: false, tags: '', matchMode: 'any' }
  }
};

// === Storage Functions ===

function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        output[key] = key in target ? deepMerge(target[key], source[key]) : source[key];
      } else {
        output[key] = source[key];
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

async function getTabSettings(tabId) {
  try {
    const result = await storage.get(STORAGE_KEY);
    const allSettings = result[STORAGE_KEY] || {};
    const savedSettings = allSettings[tabId] || {};

    // Merge: Default -> Saved Tab Settings
    const settings = deepMerge(DEFAULT_SETTINGS, savedSettings);
    
    return settings;
  } catch (error) {
    console.error('MetaGroove: Error reading tab settings', tabId, error);
    return DEFAULT_SETTINGS;
  }
}

async function setTabSettings(tabId, settings) {
  try {
    const result = await storage.get(STORAGE_KEY);
    const allSettings = result[STORAGE_KEY] || {};
    allSettings[tabId] = settings;
    await storage.set({ [STORAGE_KEY]: allSettings });
    console.log('MetaGroove: Settings saved for tab', tabId);
    return true;
  } catch (error) {
    console.error('MetaGroove: Error saving tab settings', tabId, error);
    return false;
  }
}

async function clearTabSettings(tabId) {
  try {
    const result = await storage.get(STORAGE_KEY);
    const allSettings = result[STORAGE_KEY] || {};
    if (allSettings[tabId]) {
      delete allSettings[tabId];
      await storage.set({ [STORAGE_KEY]: allSettings });
      console.log('MetaGroove: Settings cleared for tab', tabId);
    }
  } catch (error) {
    console.error('MetaGroove: Error clearing tab settings', tabId, error);
  }
}

// === Video Date Cache Functions ===

async function getVideoDateCache() {
  try {
    const result = await storage.get(VIDEO_DATE_CACHE_KEY);
    return result[VIDEO_DATE_CACHE_KEY] || {};
  } catch (error) {
    return {};
  }
}

async function setVideoDateCache(cache) {
  try {
    return await storage.set({ [VIDEO_DATE_CACHE_KEY]: cache });
  } catch (error) {
    return false;
  }
}

async function getCachedVideoDate(videoId) {
  const cache = await getVideoDateCache();
  const cached = cache[videoId];
  if (!cached) return null;
  const now = Date.now();
  if (now - cached.fetchedAt > CACHE_TTL_MS) return null;
  return cached;
}

async function cacheVideoDate(videoId, year) {
  const cache = await getVideoDateCache();
  cache[videoId] = { year, fetchedAt: Date.now() };
  await setVideoDateCache(cache);
}

// === YouTube Date Fetcher ===

async function fetchYearFromHTML(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!response.ok) return null;
    const html = await response.text();
    
    const uploadDateMatch = html.match(/<meta\s+itemprop="uploadDate"\s+content="([^"]+)"/i);
    if (uploadDateMatch) return parseInt(uploadDateMatch[1].substring(0, 4));
    
    const datePublishedMatch = html.match(/<meta\s+itemprop="datePublished"\s+content="([^"]+)"/i);
    if (datePublishedMatch) return parseInt(datePublishedMatch[1].substring(0, 4));
    
    const ytDataMatch = html.match(/var ytInitialData = ({.+?});/);
    if (ytDataMatch) {
      try {
        const ytData = JSON.parse(ytDataMatch[1]);
        const publishDate = ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.dateText?.simpleText;
        if (publishDate) {
          const yearMatch = publishDate.match(/\b(19\d{2}|20\d{2})\b/);
          if (yearMatch) return parseInt(yearMatch[1]);
        }
      } catch (e) {}
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function fetchYearFromAPI(videoId) {
  try {
    const result = await storage.get(API_KEY_STORAGE);
    const apiKey = result[API_KEY_STORAGE];
    if (!apiKey) return null;
    
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return parseInt(data.items[0].snippet.publishedAt.substring(0, 4));
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getVideoYear(videoId) {
  const cached = await getCachedVideoDate(videoId);
  if (cached) return cached.year;
  
  let year = await fetchYearFromHTML(videoId);
  if (!year) year = await fetchYearFromAPI(videoId);
  
  if (year !== null) await cacheVideoDate(videoId, year);
  return year;
}

// === Message Handlers ===

const handlers = {
  async getTabSettings(message, sender) {
    const tabId = sender.tab?.id || message.tabId;
    if (!tabId) return { success: false, error: 'Tab ID not available' };
    const settings = await getTabSettings(tabId);
    return { success: true, settings };
  },

  async setTabSettings(message, sender) {
    const tabId = sender.tab?.id || message.tabId;
    if (!tabId) return { success: false, error: 'Tab ID not available' };
    const success = await setTabSettings(tabId, message.settings);
    if (!success) return { success: false, error: 'Save failed' };
    try { await chrome.tabs.reload(tabId); } catch (e) {}
    return { success: true };
  },

  async getVideoYear(message, sender) {
    const { videoId } = message;
    if (!videoId) return { success: false, error: 'videoId missing' };
    const year = await getVideoYear(videoId);
    return { success: true, year, cached: !!(await getCachedVideoDate(videoId)) };
  },

  async setYouTubeAPIKey(message, sender) {
    const { apiKey } = message;
    try {
      await storage.set({ [API_KEY_STORAGE]: apiKey });
      return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
  },

  async getYouTubeAPIKey(message, sender) {
    try {
      const result = await storage.get(API_KEY_STORAGE);
      return { success: true, apiKey: result[API_KEY_STORAGE] || '' };
    } catch (error) { return { success: false, error: error.message }; }
  },

  async clearVideoDateCache(message, sender) {
    try {
      await storage.remove(VIDEO_DATE_CACHE_KEY);
      return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
  },

  async getCacheStats(message, sender) {
    try {
      const cache = await getVideoDateCache();
      const count = Object.keys(cache).length;
      const sizeBytes = new Blob([JSON.stringify(cache)]).size;
      return { success: true, count, sizeBytes };
    } catch (error) { return { success: false, error: error.message }; }
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message.action];
  if (handler) {
    handler(message, sender)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabSettings(tabId);
});

// Settings Inheritance for new tabs (e.g. opening link in new tab)
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId) {
    console.log(`MetaGroove: New tab ${tab.id} opened from ${tab.openerTabId}, inheriting settings...`);
    try {
      const openerSettings = await getTabSettings(tab.openerTabId);
      if (openerSettings) {
        await setTabSettings(tab.id, openerSettings);
      }
    } catch (e) {
      console.error('MetaGroove: Error inheriting settings', e);
    }
  }
});

console.log('MetaGroove Service Worker: Ready');
