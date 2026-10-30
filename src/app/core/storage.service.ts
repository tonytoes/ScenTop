import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Small key-value store for things that must survive closing the app
 * (login token, a guest's cart). Uses native storage in the mobile app and localStorage on the web.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value === null ? null : (JSON.parse(value) as T);
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) });
    } catch {
      // Storage can be blocked (private mode). The app still works, it just forgets on restart.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch {
      // see above
    }
  }
}
