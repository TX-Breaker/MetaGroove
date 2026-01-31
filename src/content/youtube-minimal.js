// MetaGroove YouTube Content Script - Optimized v2

(async function() {
  'use strict';

  console.log('MetaGroove YouTube: Initializing v2...');

  // Platform Check
  try {
    const platformSettings = await new Promise(resolve => {
      chrome.storage.local.get('metagroove_platforms', (result) => resolve(result || {}));
    });
    
    const platforms = platformSettings.metagroove_platforms || {};
    if (platforms.youtube === false) {
      console.log('MetaGroove: YouTube integration disabled by user.');
      return;
    }
  } catch (e) {
    console.warn('MetaGroove: Failed to check platform settings', e);
  }

  // State
  let settings = null;
  const processedVideoIds = new Set();
  
  // Selectors for YouTube 2024+
  const VIDEO_SELECTORS = [
    'ytd-rich-item-renderer',      // Homepage grid
    'ytd-video-renderer',          // Search results
    'ytd-grid-video-renderer',     // Channel videos
    'ytd-compact-video-renderer',  // Sidebar suggestions
    'ytd-watch-metadata'           // Main video watch page
  ].join(', ');

  // === Initialization ===
  
  async function init() {
    try {
      setupMessageListener();
      
      const response = await sendMessage({ action: 'getTabSettings' });
      if (!response || !response.success) {
        console.error('MetaGroove YouTube: Cannot load settings', response?.error);
        return;
      }
      
      settings = response.settings;
      console.log('MetaGroove YouTube: Settings loaded', settings);
      
      if (!settings.enabled) {
        console.log('MetaGroove YouTube: Filters disabled');
        return;
      }
      
      // Process existing videos
      const existingVideos = document.querySelectorAll(VIDEO_SELECTORS);
      // console.log(`MetaGroove YouTube: Found ${existingVideos.length} existing videos`);
      existingVideos.forEach(processVideoNode);
      
      // Start observer for new videos
      startObserver();
      
      // Exploration Mode
      if (settings.filters?.explorationMode?.enabled) {
        setInterval(handleExplorationMode, 2000);
      }
      
      // console.log('MetaGroove YouTube: Observer started');
      
    } catch (error) {
      console.error('MetaGroove YouTube: Initialization error', error);
    }
  }

  // === Message Listener ===
  
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'reloadPage') {
        console.log('MetaGroove YouTube: Reloading page...');
        window.location.reload();
      }
    });
  }

  // === Observer ===
  
  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          
          if (node.matches && node.matches(VIDEO_SELECTORS)) {
            processVideoNode(node);
          }
          
          if (node.querySelectorAll) {
            node.querySelectorAll(VIDEO_SELECTORS).forEach(processVideoNode);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // === Video Processing ===
  
  function processVideoNode(videoNode) {
    try {
      const videoId = extractVideoId(videoNode);
      if (!videoId || processedVideoIds.has(videoId)) return;
      
      processedVideoIds.add(videoId);
      const videoData = extractVideoData(videoNode, videoId);
      
      // Visual Options
      if (settings?.options?.showVerifiedYear && videoData.year) {
        injectVerifiedYear(videoNode, videoData.year);
      } else {
        removeVerifiedYear(videoNode);
      }

      if (shouldBeFiltered(videoData)) {
        hideVideo(videoNode);
        // console.log('MetaGroove: ❌ FILTERED -', videoData.title.substring(0, 50));
      } else {
        // console.log('MetaGroove: ✓ SHOWN -', videoData.title.substring(0, 50));
      }
    } catch (error) {
      console.error('MetaGroove YouTube: Video processing error', error);
    }
  }

  function extractVideoId(container) {
    // Special case for Watch Page Metadata
    if (container.tagName.toLowerCase() === 'ytd-watch-metadata') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('v');
    }

    const thumbnail = container.querySelector('a#thumbnail, a.ytd-thumbnail');
    if (thumbnail?.href) {
      const url = new URL(thumbnail.href);
      const videoId = url.searchParams.get('v');
      if (videoId) return videoId;
    }
    
    const videoIdAttr = container.querySelector('[data-video-id]');
    if (videoIdAttr) {
      return videoIdAttr.getAttribute('data-video-id');
    }
    
    return null;
  }

  function extractVideoData(container, videoId) {
    return {
      videoId,
      title: extractTitle(container),
      channel: extractChannel(container),
      year: extractYear(container),
      duration: extractDuration(container)
    };
  }

  function extractTitle(container) {
    const titleEl = container.querySelector('#video-title, h3 a, #video-title-link');
    return titleEl ? titleEl.textContent.trim().toLowerCase() : '';
  }

  function extractChannel(container) {
    // Try multiple selectors for channel name
    const channelSelectors = [
      'ytd-channel-name a',
      '#channel-name a',
      '#text.ytd-channel-name',
      '.ytd-channel-name #text'
    ];
    
    for (const selector of channelSelectors) {
      const channelEl = container.querySelector(selector);
      if (channelEl) {
        return channelEl.textContent.trim().toLowerCase();
      }
    }
    
    return '';
  }

  function extractYear(container) {
    const metadataTexts = container.querySelectorAll('#metadata-line span, .ytd-video-meta-block span, #info span, #date-text yt-formatted-string');
    
    for (const span of metadataTexts) {
      const text = span.textContent.trim();
      const year = parseYearFromText(text);
      if (year) return year;
    }
    
    return null;
  }

  function parseYearFromText(text) {
    // Relative date patterns (Multilingual support)
    const patterns = [
      { regex: /(\d+)\s+(year|anno|anni|god|año|jahr|ans?)/i, multiplier: 365 },
      { regex: /(\d+)\s+(month|mese|mesi|mes|monat|mois)/i, multiplier: 30 },
      { regex: /(\d+)\s+(week|settimana|settimane|semana|woche|semaine)/i, multiplier: 7 },
      { regex: /(\d+)\s+(day|giorno|giorni|día|días|tag|jour)/i, multiplier: 1 },
      // Italian "X fa" patterns
      { regex: /(\d+)\s+ann[oi]\s+fa/i, multiplier: 365 },
      { regex: /(\d+)\s+mes[ei]\s+fa/i, multiplier: 30 },
      { regex: /(\d+)\s+settiman[ae]\s+fa/i, multiplier: 7 },
      { regex: /(\d+)\s+giorn[oi]\s+fa/i, multiplier: 1 }
    ];
    
    for (const { regex, multiplier } of patterns) {
      const match = text.match(regex);
      if (match) {
        const value = parseInt(match[1]);
        const daysAgo = value * multiplier;
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.getFullYear();
      }
    }
    
    // Absolute year pattern
    const absoluteMatch = text.match(/\b(19|20)\d{2}\b/);
    if (absoluteMatch) {
      return parseInt(absoluteMatch[0]);
    }
    
    return null;
  }

  function extractDuration(container) {
    const durationEl = container.querySelector('ytd-thumbnail-overlay-time-status-renderer span, #text');
    if (!durationEl) return null;
    
    const text = durationEl.textContent.trim();
    return parseDuration(text);
  }

  function parseDuration(timeString) {
    if (!timeString) return null;
    
    const parts = timeString.split(':').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    
    return null;
  }

  // === Filtering Logic ===
  
  function shouldBeFiltered(videoData) {
    if (!settings || !settings.filters) return false;
    
    const { filters } = settings;
    
    // Year Filter - ONLY if year is available
    if (filters.year.enabled && videoData.year) {
      if (videoData.year < filters.year.min || videoData.year > filters.year.max) {
        return true;
      }
    }
    
    // Duration Filter - ONLY if duration is available
    if (filters.duration.enabled && videoData.duration !== null) {
      if (videoData.duration < filters.duration.min || videoData.duration > filters.duration.max) {
        return true;
      }
    }
    
    // Search Text Filter (Whitelist)
    if (filters.genre.enabled && filters.genre.value) {
      const searchTerms = filters.genre.value
        .toLowerCase()
        .split(',')
        .map(term => term.trim())
        .filter(Boolean);
      
      if (searchTerms.length > 0) {
        const searchableText = `${videoData.title} ${videoData.channel}`.toLowerCase();
        const hasMatch = searchTerms.some(term => searchableText.includes(term));
        
        if (!hasMatch) {
          return true;
        }
      }
    }
    
    // Blacklist Filter
    if (filters.blacklist?.enabled && filters.blacklist.keywords) {
      const blacklistTerms = filters.blacklist.keywords
        .toLowerCase()
        .split(',')
        .map(term => term.trim())
        .filter(Boolean);
      
      if (blacklistTerms.length > 0) {
        const searchableText = `${videoData.title} ${videoData.channel}`.toLowerCase();
        const hasBlacklistedTerm = blacklistTerms.some(term => searchableText.includes(term));
        
        if (hasBlacklistedTerm) {
          return true;
        }
      }
    }
    
    return false;
  }

  function hideVideo(videoNode) {
    videoNode.style.display = 'none';
    videoNode.setAttribute('data-metagroove-hidden', 'true');
  }

  // === Exploration Mode ===
  function handleExplorationMode() {
    const chipContainer = document.querySelector('ytd-feed-filter-chip-bar-renderer, yt-related-chip-cloud-renderer');
    if (!chipContainer) return;

    const chips = chipContainer.querySelectorAll('yt-chip-cloud-chip-renderer');
    
    // Detect Context
    const isSearchPage = window.location.pathname === '/results';

    chips.forEach(chip => {
      const text = chip.textContent.trim().toLowerCase();
      
      // Hide "All" and "For You"
      if (['tutti', 'all', 'alle', 'todos', 'tout', 'per te', 'for you', 'für dich', 'para ti', 'pour vous'].includes(text)) {
         chip.style.display = 'none';
      }
      
      // Strategy based on context
      if (isSearchPage) {
        // Search Results: Select "Not Watched"
        if (['non guardati', 'not watched', 'unwatched', 'nicht angesehen', 'no vistos', 'non visionnés'].some(k => text.includes(k))) {
           const isSelected = chip.getAttribute('aria-selected') === 'true' || chip.hasAttribute('selected');
           if (!isSelected) {
               const button = chip.querySelector('button') || chip;
               button.click();
           }
        }
      } else {
        // Watch Page: Select "Related"
        if (['video correlati', 'related', 'related videos', 'ähnliche', 'relacionados', 'associés'].some(k => text.includes(k))) {
           const isSelected = chip.getAttribute('aria-selected') === 'true' || chip.hasAttribute('selected');
           if (!isSelected) {
               const button = chip.querySelector('button') || chip;
               button.click();
           }
        }
      }
    });
  }

  function injectVerifiedYear(container, year) {
    const metadataTexts = container.querySelectorAll('#metadata-line span, .ytd-video-meta-block span, #info span, #date-text yt-formatted-string');
    
    for (const span of metadataTexts) {
      // Avoid injecting if already present
      if (span.querySelector('.metagroove-year')) continue;

      const text = span.textContent.trim();
      
      // If the year is already explicitly present in the text (e.g. "5 dic 2016"), don't duplicate it.
      // But if it's relative like "9 anni fa", we inject it.
      if (text.includes(year.toString())) continue;

      // Identify if this span is the date
      if (parseYearFromText(text)) {
        const yearSpan = document.createElement('span');
        yearSpan.className = 'metagroove-year';
        yearSpan.textContent = ` (${year})`;
        yearSpan.style.opacity = '0.7'; 
        yearSpan.style.marginLeft = '4px';
        span.appendChild(yearSpan);
        // Don't break, allow injecting in all valid relative date locations if multiple exist
      }
    }
  }

  function removeVerifiedYear(container) {
    const years = container.querySelectorAll('.metagroove-year');
    years.forEach(el => el.remove());
  }

  // === Communication ===
  
  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // console.error('MetaGroove YouTube: Communication error', chrome.runtime.lastError);
          resolve({ success: false });
          return;
        }
        resolve(response);
      });
    });
  }

  // === Start ===
  
  init();

})();
