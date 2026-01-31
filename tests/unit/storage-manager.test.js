// Test per Storage Manager
import StorageManager from '../../src/modules/storage/storage-manager.js';
import { STORAGE_KEYS, DEFAULT_PREFERENCES } from '../../src/utils/constants.js';

describe('StorageManager', () => {
  beforeEach(() => {
    // Reset mock storage
    global.chrome.storage.local.get.mockClear();
    global.chrome.storage.local.set.mockClear();
    global.chrome.storage.local.remove.mockClear();
    global.chrome.storage.local.clear.mockClear();
  });

  describe('get', () => {
    it('dovrebbe recuperare dati dallo storage', async () => {
      const mockData = { test: 'value' };
      global.chrome.storage.local.get.mockResolvedValue(mockData);

      const result = await StorageManager.get('test');
      
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockData);
    });

    it('dovrebbe gestire errori di storage', async () => {
      global.chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      const result = await StorageManager.get('test');
      
      expect(result).toEqual({});
    });
  });

  describe('set', () => {
    it('dovrebbe salvare dati nello storage', async () => {
      global.chrome.storage.local.set.mockResolvedValue();

      const data = { test: 'value' };
      const result = await StorageManager.set(data);
      
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith(data);
      expect(result).toBe(true);
    });

    it('dovrebbe gestire errori di salvataggio', async () => {
      global.chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      const result = await StorageManager.set({ test: 'value' });
      
      expect(result).toBe(false);
    });
  });

  describe('getPreferences', () => {
    it('dovrebbe restituire preferenze di default se non esistono', async () => {
      global.chrome.storage.local.get.mockResolvedValue({});

      const preferences = await StorageManager.getPreferences();
      
      expect(preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('dovrebbe fare merge con preferenze esistenti', async () => {
      const existingPrefs = {
        enabled: false,
        filters: {
          genre: { enabled: true, values: ['rock'] }
        }
      };
      
      global.chrome.storage.local.get.mockResolvedValue({
        [STORAGE_KEYS.USER_PREFERENCES]: existingPrefs
      });

      const preferences = await StorageManager.getPreferences();
      
      expect(preferences.enabled).toBe(false);
      expect(preferences.filters.genre.enabled).toBe(true);
      expect(preferences.filters.genre.values).toEqual(['rock']);
      // Dovrebbe mantenere altri valori di default
      expect(preferences.autoFilter).toBe(DEFAULT_PREFERENCES.autoFilter);
    });
  });

  describe('getCached', () => {
    it('dovrebbe restituire dati cached validi', async () => {
      const cachedData = {
        data: { test: 'value' },
        timestamp: Date.now() - 1000 // 1 secondo fa
      };
      
      global.chrome.storage.local.get.mockResolvedValue({
        [`${STORAGE_KEYS.API_CACHE}_test`]: cachedData
      });

      const result = await StorageManager.getCached('test', 5000);
      
      expect(result).toEqual({ test: 'value' });
    });

    it('dovrebbe restituire null per cache scaduta', async () => {
      const cachedData = {
        data: { test: 'value' },
        timestamp: Date.now() - 10000 // 10 secondi fa
      };
      
      global.chrome.storage.local.get.mockResolvedValue({
        [`${STORAGE_KEYS.API_CACHE}_test`]: cachedData
      });
      global.chrome.storage.local.remove.mockResolvedValue();

      const result = await StorageManager.getCached('test', 5000);
      
      expect(result).toBeNull();
      expect(global.chrome.storage.local.remove).toHaveBeenCalled();
    });

    it('dovrebbe restituire null se cache non esiste', async () => {
      global.chrome.storage.local.get.mockResolvedValue({});

      const result = await StorageManager.getCached('test');
      
      expect(result).toBeNull();
    });
  });

  describe('setCached', () => {
    it('dovrebbe salvare dati in cache con timestamp', async () => {
      global.chrome.storage.local.set.mockResolvedValue();
      const testData = { test: 'value' };

      const result = await StorageManager.setCached('test', testData);
      
      expect(result).toBe(true);
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        [`${STORAGE_KEYS.API_CACHE}_test`]: {
          data: testData,
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('blacklist/whitelist management', () => {
    beforeEach(() => {
      global.chrome.storage.local.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.BLACKLIST) {
          return Promise.resolve({ [STORAGE_KEYS.BLACKLIST]: ['artist1', 'artist2'] });
        }
        if (key === STORAGE_KEYS.WHITELIST) {
          return Promise.resolve({ [STORAGE_KEYS.WHITELIST]: ['artist3', 'artist4'] });
        }
        return Promise.resolve({});
      });
      global.chrome.storage.local.set.mockResolvedValue();
    });

    it('dovrebbe aggiungere artista alla blacklist', async () => {
      const result = await StorageManager.addToBlacklist('newArtist');
      
      expect(result).toBe(true);
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.BLACKLIST]: ['artist1', 'artist2', 'newArtist']
      });
    });

    it('non dovrebbe aggiungere duplicati alla blacklist', async () => {
      const result = await StorageManager.addToBlacklist('artist1');
      
      expect(result).toBe(true);
      // Non dovrebbe chiamare set se l'artista esiste già
    });

    it('dovrebbe rimuovere artista dalla blacklist', async () => {
      const result = await StorageManager.removeFromBlacklist('artist1');
      
      expect(result).toBe(true);
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.BLACKLIST]: ['artist2']
      });
    });

    it('dovrebbe gestire whitelist allo stesso modo', async () => {
      await StorageManager.addToWhitelist('newArtist');
      
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.WHITELIST]: ['artist3', 'artist4', 'newArtist']
      });
    });
  });

  describe('cleanExpiredCache', () => {
    it('dovrebbe rimuovere cache scaduta', async () => {
      const now = Date.now();
      const mockData = {
        [`${STORAGE_KEYS.API_CACHE}_valid`]: {
          data: 'valid',
          timestamp: now - 1000
        },
        [`${STORAGE_KEYS.API_CACHE}_expired`]: {
          data: 'expired',
          timestamp: now - 30000000 // Molto vecchio
        },
        'other_key': 'should_not_be_touched'
      };

      global.chrome.storage.local.get.mockResolvedValue(mockData);
      global.chrome.storage.local.remove.mockResolvedValue();

      const removedCount = await StorageManager.cleanExpiredCache();
      
      expect(removedCount).toBe(1);
      expect(global.chrome.storage.local.remove).toHaveBeenCalledWith([
        `${STORAGE_KEYS.API_CACHE}_expired`
      ]);
    });
  });

  describe('exportData', () => {
    it('dovrebbe esportare tutti i dati utente', async () => {
      const mockPrefs = { enabled: true };
      const mockBlacklist = ['artist1'];
      const mockWhitelist = ['artist2'];
      const mockStats = { totalProcessed: 100 };

      global.chrome.storage.local.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.USER_PREFERENCES) {
          return Promise.resolve({ [STORAGE_KEYS.USER_PREFERENCES]: mockPrefs });
        }
        if (key === STORAGE_KEYS.BLACKLIST) {
          return Promise.resolve({ [STORAGE_KEYS.BLACKLIST]: mockBlacklist });
        }
        if (key === STORAGE_KEYS.WHITELIST) {
          return Promise.resolve({ [STORAGE_KEYS.WHITELIST]: mockWhitelist });
        }
        if (key === STORAGE_KEYS.STATS) {
          return Promise.resolve({ [STORAGE_KEYS.STATS]: mockStats });
        }
        return Promise.resolve({});
      });

      const exportData = await StorageManager.exportData();
      
      expect(exportData).toEqual({
        preferences: mockPrefs,
        blacklist: mockBlacklist,
        whitelist: mockWhitelist,
        stats: mockStats,
        exportDate: expect.any(String),
        version: '1.0.0'
      });
    });
  });

  describe('importData', () => {
    it('dovrebbe importare dati utente', async () => {
      global.chrome.storage.local.set.mockResolvedValue();

      const importData = {
        preferences: { enabled: false },
        blacklist: ['imported1'],
        whitelist: ['imported2']
      };

      const result = await StorageManager.importData(importData);
      
      expect(result).toBe(true);
      expect(global.chrome.storage.local.set).toHaveBeenCalledTimes(3);
    });

    it('dovrebbe gestire errori di importazione', async () => {
      global.chrome.storage.local.set.mockRejectedValue(new Error('Import error'));

      const result = await StorageManager.importData({ preferences: {} });
      
      expect(result).toBe(false);
    });
  });
});