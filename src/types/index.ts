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
  syncRange: 'last7days' | 'last14days' | 'last30days' | 'all';
  syncInterval: number; // 分钟
  mergeNotes: boolean; // 是否合并笔记
  autoSync: boolean; // 是否自动同步
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

// 微信读书Cookie
export interface WeReadCookie {
  value: string;
  expiresAt: number;
}