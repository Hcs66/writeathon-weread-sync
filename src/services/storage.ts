import { WriteathonSettings, SyncSettings, SyncHistory, WeReadCookie } from '../types';

// 默认同步设置
const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  syncRange: 'last7days',
  syncInterval: 60, // 默认60分钟
  mergeNotes: true,
  autoSync: false
};

// 存储服务
export const storageService = {
  // 获取Writeathon设置
  async getWriteathonSettings(): Promise<WriteathonSettings> {
    const result = await browser.storage.local.get('writeathonSettings');
    return result.writeathonSettings || { apiToken: '', userId: '', username: '' };
  },
  
  // 保存Writeathon设置
  async saveWriteathonSettings(settings: WriteathonSettings): Promise<void> {
    await browser.storage.local.set({ writeathonSettings: settings });
  },
  
  // 获取同步设置
  async getSyncSettings(): Promise<SyncSettings> {
    const result = await browser.storage.local.get('syncSettings');
    return result.syncSettings || DEFAULT_SYNC_SETTINGS;
  },
  
  // 保存同步设置
  async saveSyncSettings(settings: SyncSettings): Promise<void> {
    await browser.storage.local.set({ syncSettings: settings });
  },
  
  // 获取微信读书Cookie
  async getWeReadCookie(): Promise<WeReadCookie | null> {
    const result = await browser.storage.local.get('wereadCookie');
    if (!result.wereadCookie) return null;
    
    // 检查Cookie是否过期
    if (result.wereadCookie.expiresAt < Date.now()) {
      await this.clearWeReadCookie();
      return null;
    }
    
    return result.wereadCookie;
  },
  
  // 保存微信读书Cookie
  async saveWeReadCookie(cookie: string, expiresInDays = 30): Promise<void> {
    const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
    await browser.storage.local.set({
      wereadCookie: {
        value: cookie,
        expiresAt
      }
    });
  },
  
  // 清除微信读书Cookie
  async clearWeReadCookie(): Promise<void> {
    await browser.storage.local.remove('wereadCookie');
  },
  
  // 获取同步历史
  async getSyncHistory(): Promise<SyncHistory[]> {
    const result = await browser.storage.local.get('syncHistory');
    return result.syncHistory || [];
  },
  
  // 保存同步历史
  async saveSyncHistory(history: SyncHistory): Promise<void> {
    const histories = await this.getSyncHistory();
    histories.unshift(history); // 添加到历史记录的开头
    
    // 只保留最近的20条记录
    const recentHistories = histories.slice(0, 20);
    await browser.storage.local.set({ syncHistory: recentHistories });
  },
  
  // 清除同步历史
  async clearSyncHistory(): Promise<void> {
    await browser.storage.local.remove('syncHistory');
  },
  
  // 获取已同步的书籍ID列表
  async getSyncedBookIds(): Promise<string[]> {
    const result = await browser.storage.local.get('syncedBookIds');
    return result.syncedBookIds || [];
  },
  
  // 保存已同步的书籍ID
  async saveSyncedBookId(bookId: string): Promise<void> {
    const syncedBookIds = await this.getSyncedBookIds();
    if (!syncedBookIds.includes(bookId)) {
      syncedBookIds.push(bookId);
      await browser.storage.local.set({ syncedBookIds });
    }
  },
  
  // 检查书籍是否已同步
  async isBookSynced(bookId: string): Promise<boolean> {
    const syncedBookIds = await this.getSyncedBookIds();
    return syncedBookIds.includes(bookId);
  },
  
  // 清除已同步的书籍ID列表
  async clearSyncedBookIds(): Promise<void> {
    await browser.storage.local.remove('syncedBookIds');
  }
};