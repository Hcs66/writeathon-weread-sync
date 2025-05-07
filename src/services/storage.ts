import {
  WriteathonSettings,
  SyncSettings,
  SyncHistory,
  WeReadCookie,
  SyncProgress,
} from "../types";

// 默认同步设置
const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  syncRange: "all",
  syncInterval: 15, // 默认15分钟
  mergeNotes: false,
  autoSync: false,
  lastSyncTime: 0, // 初始值为0，表示从未同步过
  requestDelay: 100, // 默认100毫秒（100ms）
};

// 存储服务
export const storageService = {  
  // 导出所有存储数据
  async exportAllData(): Promise<object> {
    const data = await browser.storage.local.get(null);
    return data;
  },

  // 导入存储数据（带去重功能）
  async importData(data: object): Promise<void> {
    // 获取当前存储的所有数据
    const currentData = await browser.storage.local.get(null);
    
    // 合并数据，处理特殊字段的去重
    const mergedData: Record<string, any> = { ...currentData };
    
    // 遍历导入的数据
    for (const [key, value] of Object.entries(data)) {
      // 特殊处理数组类型的数据，进行去重
      if (Array.isArray(value) && Array.isArray(mergedData[key])) {
        // 对于syncHistory等数组，根据id去重
        if (key === 'syncHistory') {
          const existingIds = new Set(mergedData[key].map((item: any) => item.id));
          const newItems = value.filter((item: any) => !existingIds.has(item.id));
          mergedData[key] = [...newItems, ...mergedData[key]];
        } 
        // 对于syncedBookIds等简单数组，直接去重
        else if (['syncedBookIds', 'autoSyncBooks'].includes(key)) {
          const uniqueSet = new Set([...mergedData[key], ...value]);
          mergedData[key] = Array.from(uniqueSet);
        }
        // 其他数组类型，默认覆盖
        else {
          mergedData[key] = value;
        }
      } 
      // 非数组类型，直接覆盖
      else {
        mergedData[key] = value;
      }
    }
    
    // 保存合并后的数据
    await browser.storage.local.clear();
    await browser.storage.local.set(mergedData);
  },
  // 获取Writeathon设置
  async getWriteathonSettings(): Promise<WriteathonSettings> {
    const result = await browser.storage.local.get("writeathonSettings");
    return (
      (result.writeathonSettings as WriteathonSettings) || {
        apiToken: "",
        userId: "",
        username: "",
      }
    );
  },

  // 保存Writeathon设置
  async saveWriteathonSettings(settings: WriteathonSettings): Promise<void> {
    await browser.storage.local.set({ writeathonSettings: settings });
  },

  // 获取同步设置
  async getSyncSettings(): Promise<SyncSettings> {
    const result = await browser.storage.local.get("syncSettings");
    return (result.syncSettings as SyncSettings) || DEFAULT_SYNC_SETTINGS;
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
    const result = await browser.storage.local.get("wereadCookie");

    if (!result.wereadCookie) return null;
    const wereadCookie = result.wereadCookie as WeReadCookie;

    // 检查Cookie是否过期
    if (wereadCookie.expiresAt < Date.now()) {
      await this.clearWeReadCookie();
      return null;
    }

    return wereadCookie;
  },

  // 保存微信读书Cookie
  async saveWeReadCookie(cookie: string, expiresInDays = 29): Promise<void> {
    const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
    await browser.storage.local.set({
      wereadCookie: {
        value: cookie,
        expiresAt,
      },
    });
  },

  // 清除微信读书Cookie
  async clearWeReadCookie(): Promise<void> {
    await browser.storage.local.remove("wereadCookie");
  },

  // 获取同步历史
  async getSyncHistory(): Promise<SyncHistory[]> {
    const result = await browser.storage.local.get("syncHistory");
    return (result.syncHistory as SyncHistory[]) || [];
  },

  // 保存同步历史
  async saveSyncHistory(history: SyncHistory): Promise<void> {
    const histories = await this.getSyncHistory();
    histories.unshift(history); // 添加到历史记录的开头
    await browser.storage.local.set({ syncHistory: histories });
  },

  // 删除单条同步历史
  async deleteSyncHistoryItem(historyId: string): Promise<void> {
    const histories = await this.getSyncHistory();
    const updatedHistories = histories.filter(item => item.id !== historyId);
    await browser.storage.local.set({ syncHistory: updatedHistories });
  },

  // 清除同步历史
  async clearSyncHistory(): Promise<void> {
    await browser.storage.local.remove("syncHistory");
  },

  // 获取已同步的书籍ID列表
  async getSyncedBookIds(): Promise<string[]> {
    const result = await browser.storage.local.get("syncedBookIds");
    return (result.syncedBookIds as string[]) || [];
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
    // 清除所有书籍的最后同步时间
    const result = await browser.storage.local.get("syncedBookIds");
    const syncedBookIds = (result.syncedBookIds as string[]) || [];

    for (const bookId of syncedBookIds) {
      const key = `book_last_sync_time_${bookId}`;
      await browser.storage.local.remove(key);
    }
    await browser.storage.local.remove("syncedBookIds");
  },

  // 保存同步进度
  async saveSyncProgress(progress: SyncProgress): Promise<void> {
    await browser.storage.local.set({ syncProgress: progress });
  },

  // 获取同步进度
  async getSyncProgress(): Promise<SyncProgress | null> {
    const result = await browser.storage.local.get("syncProgress");
    return (result.syncProgress as SyncProgress) || null;
  },

  // 清除同步进度
  async clearSyncProgress(): Promise<void> {
    await browser.storage.local.remove("syncProgress");
  },

  // 获取单本书籍的最后同步时间
  async getBookLastSyncTime(bookId: string): Promise<number> {
    const key = `book_last_sync_time_${bookId}`;
    const result = await browser.storage.local.get(key);
    return (result[key] as number) || 0;
  },

  // 保存单本书籍的最后同步时间
  async saveBookLastSyncTime(bookId: string, timestamp: number): Promise<void> {
    const key = `book_last_sync_time_${bookId}`;
    await browser.storage.local.set({ [key]: timestamp });
  },

  // 获取自动同步的书籍ID列表
  async getAutoSyncBookIds(): Promise<string[]> {
    const result = await browser.storage.local.get("autoSyncBooks");    
    return (result.autoSyncBooks as string[]) || [];
  },

  // 保存自动同步的书籍ID
  async saveAutoSyncBookId(bookId: string): Promise<void> {
    const autoSyncBooks = await this.getAutoSyncBookIds();    
    if (!autoSyncBooks.includes(bookId)) {
      autoSyncBooks.push(bookId);
      await browser.storage.local.set({ autoSyncBooks: autoSyncBooks });
    }
  },

  // 移除自动同步的书籍ID
  async removeAutoSyncBookId(bookId: string): Promise<void> {
    const autoSyncBooks = await this.getAutoSyncBookIds();
    const index = autoSyncBooks.indexOf(bookId);
    if (index !== -1) {
      autoSyncBooks.splice(index, 1);
      await browser.storage.local.set({ autoSyncBooks: autoSyncBooks });
    }
  },

  // 检查书籍是否设置为自动同步
  async isBookAutoSync(bookId: string): Promise<boolean> {
    const autoSyncBooks = await this.getAutoSyncBookIds();
    return autoSyncBooks.includes(bookId);
  },

  // 清除自动同步的书籍ID列表
  async clearAutoSyncBookIds(): Promise<void> {
    await browser.storage.local.set({ autoSyncBooks: [] });
  },
};
