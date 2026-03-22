/**
 * IndexedDB Model Cache
 * Phase 16: 3D Component Models
 *
 * Provides persistent client-side storage for 3D model files.
 * Handles model caching, retrieval, deletion, and quota management.
 */

import { Model3D, ModelCacheEntry } from '../types3d';

const DB_NAME = 'TupanModelCache';
const DB_VERSION = 1;
const STORE_NAME = 'models';
const MAX_STORAGE_MB = 500; // Maximum IndexedDB storage per model cache
const CACHE_VERSION = 1;

/**
 * Manages IndexedDB storage for 3D component models
 */
export class ModelCache {
  private static instance: IDBDatabase | null = null;
  private static initPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  private static async init(): Promise<IDBDatabase> {
    if (this.instance) {
      return this.instance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.instance = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for models
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('uploadedAt', 'model.uploadedAt', { unique: false });
          store.createIndex('format', 'model.format', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Store a model in cache
   */
  static async store(model: Model3D): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const entry: ModelCacheEntry = {
        id: model.id,
        model: {
          ...model,
          uploadedAt: Date.now(),
        },
        cachedAt: Date.now(),
        version: CACHE_VERSION,
      };

      const request = store.put(entry);

      request.onerror = () => {
        reject(new Error(`Failed to store model: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Retrieve a model from cache
   */
  static async get(modelId: string): Promise<Model3D | null> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(modelId);

      request.onerror = () => {
        reject(new Error(`Failed to retrieve model: ${request.error}`));
      };

      request.onsuccess = () => {
        const entry = request.result as ModelCacheEntry | undefined;
        resolve(entry?.model ?? null);
      };
    });
  }

  /**
   * Retrieve all models from cache
   */
  static async getAll(): Promise<Model3D[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error(`Failed to retrieve all models: ${request.error}`));
      };

      request.onsuccess = () => {
        const entries = request.result as ModelCacheEntry[];
        const models = entries.map((entry) => entry.model);
        resolve(models);
      };
    });
  }

  /**
   * Delete a model from cache
   */
  static async delete(modelId: string): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(modelId);

      request.onerror = () => {
        reject(new Error(`Failed to delete model: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all models from cache
   */
  static async clear(): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`Failed to clear cache: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get models by format
   */
  static async getByFormat(
    format: 'stl' | 'obj' | 'step'
  ): Promise<Model3D[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('format');
      const request = index.getAll(format);

      request.onerror = () => {
        reject(new Error(`Failed to query by format: ${request.error}`));
      };

      request.onsuccess = () => {
        const entries = request.result as ModelCacheEntry[];
        const models = entries.map((entry) => entry.model);
        resolve(models);
      };
    });
  }

  /**
   * Get storage usage statistics
   */
  static async getStats(): Promise<{
    totalModels: number;
    totalStorage: number;
    byFormat: Record<'stl' | 'obj' | 'step', number>;
  }> {
    const models = await this.getAll();

    const stats = {
      totalModels: models.length,
      totalStorage: models.reduce((sum, m) => sum + m.fileSize, 0),
      byFormat: {
        stl: 0,
        obj: 0,
        step: 0,
      },
    };

    models.forEach((m) => {
      stats.byFormat[m.format]++;
    });

    return stats;
  }

  /**
   * Check if storage quota is exceeded
   */
  static async isQuotaExceeded(): Promise<boolean> {
    const stats = await this.getStats();
    const quotaBytes = MAX_STORAGE_MB * 1024 * 1024;
    return stats.totalStorage > quotaBytes;
  }

  /**
   * Get remaining storage in bytes
   */
  static async getRemainingStorage(): Promise<number> {
    const stats = await this.getStats();
    const quotaBytes = MAX_STORAGE_MB * 1024 * 1024;
    return Math.max(0, quotaBytes - stats.totalStorage);
  }

  /**
   * Search models by name
   */
  static async search(query: string): Promise<Model3D[]> {
    const models = await this.getAll();
    const lowerQuery = query.toLowerCase();

    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get most recently uploaded models
   */
  static async getRecent(limit: number = 10): Promise<Model3D[]> {
    const models = await this.getAll();

    return models
      .sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0))
      .slice(0, limit);
  }

  /**
   * Export cache as JSON (for backup)
   */
  static async exportJSON(): Promise<string> {
    const models = await this.getAll();
    return JSON.stringify(models, null, 2);
  }

  /**
   * Import models from JSON
   */
  static async importJSON(json: string): Promise<number> {
    const models = JSON.parse(json) as Model3D[];
    let count = 0;

    for (const model of models) {
      try {
        await this.store(model);
        count++;
      } catch (error) {
        console.warn(`Failed to import model ${model.id}:`, error);
      }
    }

    return count;
  }

  /**
   * Cleanup old cache entries (older than days)
   */
  static async cleanup(olderThanDays: number = 30): Promise<number> {
    const models = await this.getAll();
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const model of models) {
      if ((model.uploadedAt ?? 0) < cutoffTime) {
        await this.delete(model.id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Close database connection (for cleanup)
   */
  static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
    this.initPromise = null;
  }
}
