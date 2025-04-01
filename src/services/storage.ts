import { WriteathonSettings, SyncSettings, SyncHistory, WeReadCookie, SyncProgress } from '../types';

// 默认同步设置
const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  syncRange: 'last7days',
  syncInterval: 60, // 默认60分钟
  mergeNotes: false,
  autoSync: false,
  lastSyncTime: 0, // 初始值为0，表示从未同步过
  requestDelay: 500// 默认500毫秒（500ms）
};

// 存储服务
export const storageService = {
  // 获取Writeathon设置
  async getWriteathonSettings(): Promise<WriteathonSettings> {
    const result = await browser.storage.local.get('writeathonSettings');
    return result.writeathonSettings as WriteathonSettings || { apiToken: '', userId: '', username: '' };
  },
  
  // 保存Writeathon设置
  async saveWriteathonSettings(settings: WriteathonSettings): Promise<void> {
    await browser.storage.local.set({ writeathonSettings: settings });
  },
  
  // 获取同步设置
  async getSyncSettings(): Promise<SyncSettings> {
    const result = await browser.storage.local.get('syncSettings');
    return result.syncSettings as SyncSettings || DEFAULT_SYNC_SETTINGS;
  },
  
  // 保存同步设置
  async saveSyncSettings(settings: SyncSettings): Promise<void> {
    await browser.storage.local.set({ syncSettings: settings });
  },

  // 重置最后同步时间
  async resetLastSyncTime(): Promise<void> {
    const syncSettings = await this.getSyncSettings();
    syncSettings.lastSyncTime = 0;
    await this.saveSyncSettings(syncSettings);
  },
  
  // 获取微信读书Cookie
  async getWeReadCookie(): Promise<WeReadCookie | null> {
    const result = await browser.storage.local.get('wereadCookie');
    
    if (!result.wereadCookie) return null;
    const wereadCookie = result.wereadCookie as WeReadCookie;
    
    // 检查Cookie是否过期
    if (wereadCookie.expiresAt < Date.now()) {
      await this.clearWeReadCookie();
      return null;
    }
    
    return wereadCookie ;
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
    return result.syncHistory as SyncHistory[] || [];
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
    return result.syncedBookIds as string[] || [];
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
  },
  
  // 保存同步进度
  async saveSyncProgress(progress: SyncProgress): Promise<void> {
    await browser.storage.local.set({ syncProgress: progress });
  },
  
  // 获取同步进度
  async getSyncProgress(): Promise<SyncProgress | null> {
    const result = await browser.storage.local.get('syncProgress');
    return result.syncProgress as SyncProgress || null;
  },
  
  // 清除同步进度
  async clearSyncProgress(): Promise<void> {
    await browser.storage.local.remove('syncProgress');
  }
};