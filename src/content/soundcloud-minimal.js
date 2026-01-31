// MetaGroove - SoundCloud Content Script

(async () => {
  'use strict';
  
  // === Configurations ===
  const TRACK_SELECTOR = 'li.soundList__item, div.soundList__item, li.compactTrackList__item, li.lazyLoadingList__listItem, li.trackList__item, li.searchList__item, li.userStream__item, div.soundBadge, .trackItem, div.visualSound, li.relatedTracks__item, .audibleTile, li.visualList__item, .userHome__spotlight .visualList__item, [class*="visualList__item"], a.soundTitle__title';
  
  // === State ===
  let currentPreferences = {};
  let isEnabled = false;
  const processedNodes = new Set();
  let observer;
  let scrollCheckInterval;

  // === Platform Check ===
  try {
    const platformSettings = await new Promise(resolve => {
      chrome.storage.local.get('metagroove_platforms', (result) => resolve(result || {}));
    });
    
    const platforms = platformSettings.metagroove_platforms || {};
    if (platforms.soundcloud === false) {
      console.log('MetaGroove: SoundCloud integration disabled by user.');
      return;
    }
  } catch (e) {
    console.warn('MetaGroove: Failed to check platform settings', e);
  }

  console.log("MetaGroove SC: Script loaded.");

  /**
   * Checks if any filter is active
   */
  function hasActiveFilters() {
    const { filters } = currentPreferences;
    if (!filters) return false;
    
    return filters.year?.enabled ||
           filters.duration?.enabled ||
           filters.genre?.enabled ||
           filters.blacklist?.enabled ||
           filters.hashtags?.enabled;
  }

  // Finds the correct container to hide
  function getRemovableContainer(node) {
    const container = node.closest('li.soundList__item, div.soundList__item, li.compactTrackList__item, li.lazyLoadingList__listItem, li.trackList__item, li.searchList__item, li.userStream__item, div.soundBadge, article, .visualSound');
    return container || node;
  }

  // Injects global CSS to manage hidden elements
  function injectGlobalCSS() {
    const styleId = 'metagroove-filter-css';
    if (document.getElementById(styleId)) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* MetaGroove Filters */
      li.metagroove-hidden,
      div.metagroove-hidden,
      a.metagroove-hidden,
      [data-metagroove-filtered="true"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  injectGlobalCSS();

  // --- TIME-BASED DISCOVERY (Ultimate Fallback) ---
  // Scans visible date elements to find track containers
  function scanTimeElements() {
    if (!isEnabled) return;
    
    // Search for <time> and related spans
    const dateEls = [
        ...Array.from(document.querySelectorAll('time')),
        ...Array.from(document.querySelectorAll('span[class*="at-"]')), 
        ...Array.from(document.querySelectorAll('.relativeTime'))
    ];

    dateEls.forEach(el => {
        // Validate if it looks like a relative date
        const text = el.textContent.trim();
        if (!text.match(/\d+\s+(an|year|mes|mon|gior|day|week|sett|ore|hour|min|sec)/i)) {
             if (el.tagName !== 'TIME') return;
        }

        // Ascend to track container
        let container = el.closest('li') || 
                        el.closest('.visualSound') || 
                        el.closest('.audibleTile') ||
                        el.closest('.soundList__item') ||
                        el.closest('[role="listitem"]');
        
        if (!container) {
            // Manual ascent if standard selectors fail (e.g. new layouts)
            let parent = el.parentElement;
            for (let i = 0; i < 7; i++) { 
                if (!parent || parent === document.body) break;
                
                if (parent.tagName === 'UL') break;

                // Check for SoundCloud title class
                if (parent.querySelector('.soundTitle__title')) {
                    container = parent;
                    // Prefer LI wrapper if exists
                    const liCheck = parent.closest('li');
                    if (liCheck) container = liCheck;
                    break;
                }
                parent = parent.parentElement;
            }
        }

        if (container && !container.hasAttribute('data-mg-processed')) {
            processTrackNode(container);
        }
    });
  }

  setInterval(scanTimeElements, 1500);

  // --- SPOTLIGHT FINDER (Backup for "In Spotlight" sections) ---
  function scanSpotlightTracks() {
    if (!isEnabled) return;
    // XPath to find headers like "Spotlight" or "In evidenza"
    const xpath = "//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'in evidenza') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'spotlight')]";
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    
    for (let i = 0; i < result.snapshotLength; i++) {
        const header = result.snapshotItem(i);
        if (header.offsetParent === null) continue;

        let container = header.nextElementSibling; 
        if(!container) container = header.parentElement?.nextElementSibling;
        if(!container) container = header.parentElement?.parentElement?.nextElementSibling;

        if (container) {
             // Broad search within container
             const items = container.querySelectorAll('li, div > div'); 
             items.forEach(item => {
                 if (item.innerHTML && item.innerHTML.includes('soundTitle__title')) {
                      if (!item.hasAttribute('data-mg-processed')) {
                          processTrackNode(item);
                      }
                 }
             });
        }
    }
  }
  setInterval(scanSpotlightTracks, 3000);

  // --- SETTINGS & INIT ---

  async function getTabSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getTabSettings" });
      if (response && response.success) {
        currentPreferences = response.settings;
        isEnabled = currentPreferences.enabled;
        // console.log("MetaGroove SC: Settings loaded", currentPreferences);
      } else {
        isEnabled = false;
      }
    } catch (error) {
      // console.error("MetaGroove SC: Preference error", error);
      isEnabled = false;
    }
  }

  async function waitForTracks() {
    return new Promise((resolve) => {
      const checkTracks = () => {
        const tracks = document.querySelectorAll(TRACK_SELECTOR);
        if (tracks.length > 0) {
          // console.log(`MetaGroove SC: Found ${tracks.length} tracks, proceeding...`);
          resolve(tracks.length);
        } else {
          setTimeout(checkTracks, 500);
        }
      };
      checkTracks();
    });
  }

  function extractTrackData(trackNode) {
    try {
      // Locate title, artist, duration elements
      // Optimized selectors to avoid false positives (e.g. reposter name or time links)
      // We prioritize specific classes over generic link selectors
      const titleEl = trackNode.querySelector('.trackItem__trackTitle, .soundTitle__title > span, .soundTitle__title, .soundBadge__title, .compactTrackListItem__content');
      
      // Fallback: search for link with specific pattern if classes missing
      const titleLinkFallback = trackNode.querySelector('a.soundTitle__title') || 
                                Array.from(trackNode.querySelectorAll('a[href]')).find(a => 
                                  /\/(tracks|sets)\//.test(a.href) && !a.classList.contains('soundTitle__username')
                                );

      const targetTitleEl = titleEl || titleLinkFallback;

      const artistEl = trackNode.querySelector('.trackItem__username, .soundTitle__username, .soundBadge__username, .compactTrackListItem__user');
      const durationEl = trackNode.querySelector('.trackItem__duration span, .soundBadge time, time, span[aria-label*="Duration"], .playbackTimeline__duration span:not(.sc-visuallyhidden)');
  
      if (!targetTitleEl) {
         // console.warn('MetaGroove SC: Title not found for node', trackNode); // Debug
         return null;
      }

      const title = targetTitleEl.textContent.trim().toLowerCase();
      const artist = artistEl ? artistEl.textContent.trim().toLowerCase() : '';
      
      let duration = 0;
      if (durationEl) {
         const txt = durationEl.textContent.trim(); // e.g. "5:37"
         const parts = txt.split(':').map(Number);
         if (parts.length === 2) duration = parts[0] * 60 + parts[1];
         if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      const year = extractYear(trackNode);
      const hashtags = extractHashtags(trackNode);
  
      return { title, artist, duration, year, hashtags };
    } catch (error) {
      return null;
    }
  }

  function extractYear(trackNode) {
    const currentYear = new Date().getFullYear();
    
    // 1) HTML5 time element
    const timeEls = trackNode.querySelectorAll('time');
    for (const t of timeEls) {
      const dt = t.getAttribute('datetime');
      if (dt) {
        const m = dt.match(/^(\d{4})/);
        if (m) return parseInt(m[1], 10);
      }
    }
    
    // 2) Relative text patterns (Multilingual)
    const relativePatterns = [
      { regex: /(\d+)\s+ann[oi]\s+fa/i, mult: 1 },
      { regex: /(\d+)\s+years?\s+ago/i, mult: 1 },
      { regex: /hace\s+(\d+)\s+años?/i, mult: 1 }, 
      { regex: /vor\s+(\d+)\s+jahren?/i, mult: 1 },
      { regex: /(\d+)\s+ans?\s+/i, mult: 1 } 
    ];
  
    const els = trackNode.querySelectorAll('time, span, div, a');
    for (const el of els) {
      const raw = el.textContent.trim();
      if (!raw) continue;
      for (const { regex, mult } of relativePatterns) {
        const m = raw.match(regex);
        if (m) {
          const v = parseInt(m[1], 10);
          return currentYear - Math.round(v * mult);
        }
      }
    }
    
    // 3) Fallback: Year in title (e.g. "(2015)")
    const titleText = trackNode.textContent; 
    const tm = titleText.match(/(?:^|[\s\-\(\[\{])((19[5-9]\d|20[0-2]\d|2030))(?:[\]\)\}\s]|$)/);
    if (tm) return parseInt(tm[1], 10);

    return null;
  }

  function extractHashtags(trackNode) {
    const hashtags = [];
    // From tag links
    const tagLinks = trackNode.querySelectorAll('a[href*="/tags/"]');
    tagLinks.forEach(link => {
      const href = link.getAttribute('href');
      const tagMatch = href && href.match(/\/tags\/([^\/\?]+)/);
      if (tagMatch) hashtags.push(tagMatch[1].toLowerCase());
    });
    // From text content (if links missing)
    if (hashtags.length === 0) {
        const plainTags = trackNode.textContent.match(/#(\w+)/g);
        if (plainTags) {
            plainTags.forEach(t => hashtags.push(t.substring(1).toLowerCase()));
        }
    }
    return hashtags;
  }

  function shouldBeFiltered(trackData) {
    if (!trackData) return false;
    const { filters } = currentPreferences;
    if (!filters) return false;

    // Year Filter
    if (filters.year?.enabled) {
      if (trackData.year === null) {
        if (!filters.year.showUnknownYear) {
            return true; 
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
    if (filters.duration?.enabled && trackData.duration !== 0) {
      const min = filters.duration.min ?? 0;
      const max = filters.duration.max ?? Infinity;
      if (trackData.duration < min || trackData.duration > max) {
        return true;
      }
    }

    // Title Search Filter (Whitelist)
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

    // Hashtags Filter
    if (filters.hashtags?.enabled && filters.hashtags.tags) {
      const requiredTags = filters.hashtags.tags.toLowerCase().split(',').map(t => t.trim().replace(/^#/, ''));
      if (requiredTags.length > 0) {
        const trackTags = trackData.hashtags || [];
        const matchMode = filters.hashtags.matchMode || 'any';
        
        let isMatch = false;
        if (matchMode === 'all') {
          isMatch = requiredTags.every(tag => trackTags.includes(tag));
        } else {
          isMatch = requiredTags.some(tag => trackTags.includes(tag));
        }
        
        if (!isMatch) {
             return true;
        }
      }
    }

    return false;
  }

  function injectVerifiedYear(trackNode, year) {
    const timeEls = trackNode.querySelectorAll('time, .relativeTime, span[class*="at-"]');
    let targetEl = null;
    
    for (const el of timeEls) {
        if (el.querySelector('.metagroove-year')) return;
        if (/\d/.test(el.textContent) && /(ago|fa|jahren|years|anni)/i.test(el.textContent)) {
            targetEl = el;
            break;
        }
    }
    
    if (targetEl) {
        const span = document.createElement('span');
        span.className = 'metagroove-year';
        span.textContent = ` (${year})`;
        span.style.opacity = '0.7';
        span.style.marginLeft = '4px';
        targetEl.appendChild(span);
    }
  }

  function removeVerifiedYear(trackNode) {
    const years = trackNode.querySelectorAll('.metagroove-year');
    years.forEach(el => el.remove());
  }

  function applyFilter(node, trackId) {
    const targetNode = getRemovableContainer(node);
    if (!targetNode) return;
    
    targetNode.classList.add('metagroove-hidden');
    targetNode.setAttribute('data-metagroove-filtered', 'true');
    targetNode.style.display = 'none'; // Force hide
    
    try {
      const placeholder = document.createComment('MetaGroove removed');
      targetNode.replaceWith(placeholder);
    } catch(e) {
      targetNode.remove(); // Fallback
    }
  }

  function processTrackNode(initialNode) {
    if (!isEnabled) return;

    let node = initialNode;

    // Container fix if we caught a title element
    if (node.tagName === 'A' || node.classList.contains('soundTitle__title')) {
         const container = node.closest('li') || 
                           node.closest('.visualSound') || 
                           node.closest('.soundList__item') ||
                           node.parentElement?.parentElement?.parentElement;
         if (container) node = container;
    }
    
    if (node.hasAttribute('data-mg-processed')) return;
    
    const trackData = extractTrackData(node);
    if (!trackData) {
       node.setAttribute('data-mg-processed', 'true');
       return;
    }
    
    const trackId = `${trackData.title}|${trackData.artist}`;
    processedNodes.add(trackId);
    node.setAttribute('data-mg-processed', 'true');

    // Visual Options
    if (currentPreferences?.options?.showVerifiedYear && trackData.year) {
      injectVerifiedYear(node, trackData.year);
    } else {
      removeVerifiedYear(node);
    }

    if (shouldBeFiltered(trackData)) {
      applyFilter(node, trackId);
    }
  }
  
  function applyFiltersToAll() {
    if (!isEnabled) return;
    const tracks = document.querySelectorAll(TRACK_SELECTOR);
    tracks.forEach(track => processTrackNode(track));
  }

  async function autoScroll() {
    return new Promise((resolve) => {
      let lastHeight = 0;
      let sameHeightCount = 0;
      let scrollCount = 0;
      let lastProcessedCount = 0;
      const MAX_SCROLLS = 500; // High limit for deep search
      
      console.log('MetaGroove SC: Auto-scroll started...');
      
      const scrollInterval = setInterval(() => {
        scrollCount++;
        const currentHeight = document.body.scrollHeight;
        const scrollPosition = window.scrollY + window.innerHeight;
        const currentProcessedCount = processedNodes.size;
        
        window.scrollBy(0, 1000);
        
        const isAtBottom = scrollPosition >= currentHeight - 200;
        
        // Logic to prevent premature stop due to hiding elements
        if (currentProcessedCount > lastProcessedCount) {
            sameHeightCount = 0;
            lastProcessedCount = currentProcessedCount;
        } else if (currentHeight === lastHeight) {
             if (isAtBottom) sameHeightCount++;
        } else {
            sameHeightCount = 0;
            lastHeight = currentHeight;
        }
        
        const shouldStop = (sameHeightCount >= 15 && isAtBottom) || scrollCount >= MAX_SCROLLS;
        
        if (shouldStop) {
          clearInterval(scrollInterval);
          console.log('MetaGroove SC: Auto-scroll complete.');
          window.scrollTo(0, 0);
          resolve();
        }
      }, 200);
    });
  }

  function startScrollCheck() {
    if (scrollCheckInterval) clearInterval(scrollCheckInterval);
    scrollCheckInterval = setInterval(applyFiltersToAll, 2000);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      if (!isEnabled) return;
      applyFiltersToAll(); 
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // Listen for real-time settings updates
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
      console.log('MetaGroove SC: Settings updated', changes.settings.newValue);
      currentPreferences = changes.settings.newValue;
      isEnabled = currentPreferences.enabled;
      
      // Reset to re-apply filters
      document.querySelectorAll('[data-mg-processed]').forEach(el => el.removeAttribute('data-mg-processed'));
      
      applyFiltersToAll();
      scanTimeElements();
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reloadPage") window.location.reload();
    return true;
  });

  async function main() {
    await getTabSettings();
    if (isEnabled) {
      if (hasActiveFilters()) {
        await waitForTracks();
        startObserver();
        await autoScroll();
        startScrollCheck();
      } else {
        startObserver();
      }
    }
  }

  main();

})();
