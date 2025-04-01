// 微信读书相关类型
export interface WeReadBook {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  category: string;
}

export interface WeReadNote {
  bookId: string;
  chapterUid: number;
  createTime: number;
  markText: string;
  content: string;
  noteId: string;
}

export interface WeReadBookmark {
  bookId: string;
  chapterUid: number;
  createTime: number;
  markText: string;
  bookmarkId: string;
}

// Writeathon相关类型
export interface WriteathonSettings {
  apiToken: string;
  userId: string;
  username?: string; // 用户名，可选字段
}

// 同步设置
export interface SyncSettings {
  syncRange: "last1days" |'last7days' | 'last14days' | 'last30days' | 'all';
  syncInterval: number; // 分钟
  mergeNotes: boolean; // 是否合并笔记
  autoSync: boolean; // 是否自动同步
  lastSyncTime?: number; // 上次同步时间（毫秒时间戳）
  requestDelay: number; // 请求延迟时间（毫秒）
}

// 同步历史
export interface SyncHistory {
  id: string;
  timestamp: string;
  notesCount: number;
  bookmarksCount: number;
  success: boolean;
  message: string;
}

// 同步进度
export interface SyncProgress {
  currentBook: number; // 当前同步的书籍索引
  totalBooks: number; // 总书籍数量
  currentBookTitle: string; // 当前同步的书籍标题
  isCompleted: boolean; // 是否完成
}

// 微信读书Cookie
export interface WeReadCookie {
  value: string;
  expiresAt: number;
}