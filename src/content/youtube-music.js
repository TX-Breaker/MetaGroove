// MetaGroove YouTube Music Content Script - Optimized

(function() {
  'use strict';

  console.log('MetaGroove YTM: Initializing...');

  // State
  let settings = null;
  const processedTrackIds = new Set();
  
  // Selectors for YouTube Music 2024+
  const TRACK_SELECTORS = [
    'ytmusic-responsive-list-item-renderer',
    'ytmusic-two-row-item-renderer'
  ].join(', ');

  // === Initialization ===
  
  async function init() {
    try {
      // Platform Check
      const platformSettings = await new Promise(resolve => {
        chrome.storage.local.get('metagroove_platforms', resolve);
      });
      
      const platforms = platformSettings.metagroove_platforms || {};
      // Default YTM to FALSE if not set
      const isYtmEnabled = platforms.youtube_music === true; // Strict true check, default false
      
      if (!isYtmEnabled) {
        console.log('MetaGroove: YouTube Music integration disabled (default).');
        return;
      }

      setupMessageListener();
      
      const response = await sendMessage({ action: 'getTabSettings' });
      if (!response || !response.success) {
        console.error('MetaGroove YTM: Cannot load settings', response?.error);
        return;
      }
      
      settings = response.settings;
      console.log('MetaGroove YTM: Settings loaded', settings);
      
      if (!settings.enabled) {
        console.log('MetaGroove YTM: Filters disabled');
        return;
      }
      
      await waitForTracks();
      
      // Process existing tracks
      const existingTracks = document.querySelectorAll(TRACK_SELECTORS);
      // console.log(`MetaGroove YTM: Found ${existingTracks.length} existing tracks`);
      existingTracks.forEach(processTrackNode);
      
      // Start observer
      startObserver();
      // console.log('MetaGroove YTM: Observer started');
      
    } catch (error) {
      console.error('MetaGroove YTM: Initialization error', error);
    }
  }

  /**
   * Wait for tracks to load
   */
  async function waitForTracks() {
    return new Promise((resolve) => {
      const checkTracks = () => {
        const tracks = document.querySelectorAll(TRACK_SELECTORS);
        if (tracks.length > 0) {
          // console.log(`MetaGroove YTM: Found ${tracks.length} tracks, proceeding...`);
          resolve();
        } else {
          setTimeout(checkTracks, 500);
        }
      };
      checkTracks();
    });
  }

  // === Message Listener ===
  
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'reloadPage') {
        console.log('MetaGroove YTM: Reloading page...');
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
          
          if (node.matches && node.matches(TRACK_SELECTORS)) {
            processTrackNode(node);
          }
          
          if (node.querySelectorAll) {
            node.querySelectorAll(TRACK_SELECTORS).forEach(processTrackNode);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // === Track Processing ===
  
  async function processTrackNode(trackNode) {
    try {
      const trackId = extractTrackId(trackNode);
      if (!trackId || processedTrackIds.has(trackId)) return;
      
      processedTrackIds.add(trackId);
      const trackData = await extractTrackData(trackNode, trackId);
      
      if (shouldBeFiltered(trackData)) {
        hideTrack(trackNode);
        // console.log(`MetaGroove YTM: ✗ FILTERED - "${trackData.title.substring(0, 40)}"`);
      }
    } catch (error) {
      console.error('MetaGroove YTM: Track processing error', error);
    }
  }

  function extractTrackId(container) {
    const playButton = container.querySelector('ytmusic-play-button-renderer');
    if (playButton) {
      const videoId = playButton.getAttribute('video-id');
      if (videoId) return videoId;
    }
    
    const link = container.querySelector('a.yt-simple-endpoint');
    if (link?.href) {
      const url = new URL(link.href);
      const videoId = url.searchParams.get('v');
      if (videoId) return videoId;
    }
    
    return `track_${Date.now()}_${Math.random()}`;
  }

  async function extractTrackData(container, trackId) {
    const data = {
      trackId,
      title: extractTitle(container),
      artist: extractArtist(container),
      duration: extractDuration(container),
      year: null
    };
    
    // TWO-LEVEL STRATEGY:
    // 1. FIRST: Local DOM extraction (artist/album pages often show year)
    // 2. THEN: Fallback fetch from youtube.com (required for playlists)
    
    // 1. Local DOM Extraction
    data.year = extractYearFromDOM(container);
    
    if (data.year) {
      // console.log(`MetaGroove YTM [DOM]: Year ${data.year} (local) - "${data.title.substring(0,50)}"`);
    } else {
      // 2. Fallback: Fetch from YouTube.com via service worker
      try {
        const response = await sendMessage({
          action: 'getVideoYear',
          videoId: trackId
        });
        
        if (response?.success && response.year) {
          data.year = response.year;
          // const cacheStatus = response.cached ? '(cached)' : '(fetched)';
          // console.log(`MetaGroove YTM [YOUTUBE]: Year ${data.year} ${cacheStatus} - "${data.title.substring(0,50)}"`);
        } else {
          // console.log(`MetaGroove YTM [YOUTUBE]: Year NOT available for "${data.title.substring(0,50)}"`);
        }
      } catch (error) {
        console.error('MetaGroove YTM: Error fetching year from YouTube', error);
      }
    }
    
    return data;
  }

  function extractTitle(container) {
    // 1. flex-column with main title
    const titleFlexCol = container.querySelector('.flex-columns .title-column yt-formatted-string a, .flex-columns yt-formatted-string.title a');
    if (titleFlexCol?.textContent) {
      const title = titleFlexCol.textContent.trim();
      if (title.length > 1) {
        return title.toLowerCase();
      }
    }
    
    // 2. aria-label of play button
    const playButton = container.querySelector('ytmusic-play-button-renderer');
    if (playButton) {
      const ariaLabel = playButton.getAttribute('aria-label');
      if (ariaLabel) {
        // e.g. "Play My Sacrifice by Creed"
        const playMatch = ariaLabel.match(/(?:Riproduci|Play)\s+(.+?)\s+(?:di|by|de|von)\s+/i);
        if (playMatch) {
          return playMatch[1].trim().toLowerCase();
        }
        const simpleMatch = ariaLabel.match(/(?:Riproduci|Play)\s+(.+)/i);
        if (simpleMatch) {
          return simpleMatch[1].trim().toLowerCase();
        }
      }
    }
    
    // 3. First significant link
    const firstLink = container.querySelector('a.yt-simple-endpoint[href*="/watch?"]');
    if (firstLink?.textContent) {
      const text = firstLink.textContent.trim();
      if (text.length > 2 && !/^\d+$/.test(text) && !/^\d+:\d+$/.test(text)) {
        return text.toLowerCase();
      }
    }
    
    return '';
  }

  function extractArtist(container) {
    // 1. Channel link
    const channelLink = container.querySelector('a.yt-simple-endpoint[href*="/channel/"]');
    if (channelLink?.textContent) {
      const artist = channelLink.textContent.trim();
      if (artist.length > 0) {
        return artist.toLowerCase();
      }
    }
    
    // 2. Secondary columns
    const secondaryCol = container.querySelector('.secondary-flex-columns yt-formatted-string a, .flex-columns .secondary-flex-columns a');
    if (secondaryCol?.textContent) {
      const artist = secondaryCol.textContent.trim();
      if (artist.length > 0) {
        return artist.toLowerCase();
      }
    }
    
    // 3. Second link
    const allLinks = container.querySelectorAll('a.yt-simple-endpoint');
    if (allLinks.length > 1) {
      const artistCandidate = allLinks[1].textContent.trim();
      if (artistCandidate.length > 0 && !/^\d+$/.test(artistCandidate)) {
        return artistCandidate.toLowerCase();
      }
    }
    
    return '';
  }

  function extractDuration(container) {
    const parseDuration = (text) => {
      const match = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (match) {
        const hours = match[3] ? parseInt(match[1]) : 0;
        const minutes = match[3] ? parseInt(match[2]) : parseInt(match[1]);
        const seconds = match[3] ? parseInt(match[3]) : parseInt(match[2]);
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        if (totalSeconds > 0 && totalSeconds < 10800) {
          return totalSeconds;
        }
      }
      return null;
    };
    
    const fixedColSelectors = [
      '.fixed-columns yt-formatted-string',
      '.fixed-columns span',
      'ytmusic-responsive-list-item-renderer .fixed-columns yt-formatted-string',
      'ytmusic-responsive-list-item-renderer .fixed-columns span',
      '.fixed-columns',
      '[class*="fixed"] yt-formatted-string',
      '[class*="fixed"] span'
    ];
    
    for (const selector of fixedColSelectors) {
      const elements = container.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        const duration = parseDuration(text);
        if (duration) return duration;
      }
    }
    
    const allElements = Array.from(container.querySelectorAll('yt-formatted-string, span, div, a'));
    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
        const duration = parseDuration(text);
        if (duration) return duration;
      }
    }
    
    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      const duration = parseDuration(text);
      if (duration) return duration;
    }
    
    return null;
  }

  function extractYearFromDOM(container) {
    const currentYear = new Date().getFullYear();
    
    const allText = container.querySelectorAll('yt-formatted-string, span, div, a');
    for (const el of allText) {
      const text = el.textContent?.trim() || '';
      
      // Pattern "Album • YYYY", "EP • YYYY", "Single • YYYY"
      const releaseMatch = text.match(/(?:Album|EP|Single|Singolo|Álbum)\s*[•·]\s*(19[5-9]\d|20[0-2]\d|2030)/i);
      if (releaseMatch) {
        const year = parseInt(releaseMatch[1]);
        return year;
      }
    }
    
    for (const el of allText) {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      
      for (const searchText of [text, ariaLabel]) {
        const yearMatch = searchText.match(/\b(19[5-9]\d|20[0-2]\d|2030)\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          const colonPos = searchText.indexOf(':');
          const yearPos = searchText.indexOf(yearMatch[1]);
          
          if (colonPos === -1 || yearPos > colonPos + 3) {
            if (year >= 1950 && year <= currentYear) {
              return year;
            }
          }
        }
      }
    }
    
    return null;
  }

  // === Filtering Logic ===
  
  function shouldBeFiltered(trackData) {
    if (!settings || !settings.filters) return false;
    
    const { filters } = settings;
    
    // Year Filter
    if (filters.year?.enabled) {
      if (trackData.year === null) {
        const showUnknown = filters.year.showUnknownYear ?? false;
        if (!showUnknown) {
          return true; // Hide tracks without year
        }
      } else {
        const minYear = filters.year.min || 1950;
        const maxYear = filters.year.max || 2030;
        
        if (trackData.year < minYear || trackData.year > maxYear) {
          return true;
        }
      }
    }
    
    // Duration Filter
    if (filters.duration?.enabled && trackData.duration !== null) {
      if (trackData.duration < filters.duration.min || trackData.duration > filters.duration.max) {
        return true;
      }
    }
    
    // Search Filter
    if (filters.genre?.enabled && filters.genre.value) {
      const searchTerms = filters.genre.value
        .toLowerCase()
        .split(',')
        .map(term => term.trim())
        .filter(Boolean);
      
      if (searchTerms.length > 0) {
        const searchableText = `${trackData.title} ${trackData.artist}`;
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
        const searchableText = `${trackData.title} ${trackData.artist}`.toLowerCase();
        const hasBlacklistedTerm = blacklistTerms.some(term => searchableText.includes(term));
        
        if (hasBlacklistedTerm) {
          return true;
        }
      }
    }
    
    return false;
  }

  function hideTrack(trackNode) {
    trackNode.style.display = 'none';
    trackNode.setAttribute('data-metagroove-hidden', 'true');
  }

  // === Communication ===
  
  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('MetaGroove YTM: Communication error', chrome.runtime.lastError);
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
