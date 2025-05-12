import { v4 as uuidv4 } from "uuid";
import { storageService } from "./storage";
import { wereadService } from "./weread";
import { writeathonService } from "./writeathon";
import {
  SyncHistory,
  SyncProgress,
  WeReadBook,
  WeReadBookmark,
  WeReadNote,
} from "../types";
// 卡片标题最大长度
const CRAD_TITLE_MAX_LENGTH = 10;
// 更新同步进度
const updateSyncProgress = (progress: SyncProgress) => {
  if (progress.isAutoSync) return;
  // 创建一个新的自定义事件，用于通知同步进度更新
  const syncProgressEvent = new CustomEvent<SyncProgress>(
    "sync-progress-update",
    {
      detail: progress,
    }
  );
  // 触发事件
  document.dispatchEvent(syncProgressEvent);
  // 保存进度到存储
  storageService.saveSyncProgress(progress);
};

// 同步服务
export const syncService = {
  // 同步单本书籍
  async syncSingleBook(
    bookId: string,
    isIncremental: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    notesCount: number;
    bookmarksCount: number;
    book?: WeReadBook;
  }> {
    try {
      // 获取设置
      const writeathonSettings = await storageService.getWriteathonSettings();
      const syncSettings = await storageService.getSyncSettings();
      const wereadCookie = await storageService.getWeReadCookie();

      // 检查设置是否完整
      if (!writeathonSettings.apiToken || !writeathonSettings.userId) {
        return {
          success: false,
          message: "请先设置Writeathon API Token和用户ID",
          notesCount: 0,
          bookmarksCount: 0,
        };
      }

      if (!wereadCookie) {
        return {
          success: false,
          message: "请先登录微信读书",
          notesCount: 0,
          bookmarksCount: 0,
        };
      }

      // 验证Writeathon凭证
      const isValidCredentials = await writeathonService.validateCredentials(
        writeathonSettings
      );
      if (!isValidCredentials) {
        return {
          success: false,
          message: "Writeathon API Token或用户ID无效",
          notesCount: 0,
          bookmarksCount: 0,
        };
      }

      // 获取书籍详情
      const book = await wereadService.getBookDetail(
        wereadCookie.value,
        bookId
      );
      if (!book) {
        return {
          success: false,
          message: "获取书籍详情失败",
          notesCount: 0,
          bookmarksCount: 0,
        };
      }

      // 获取书籍的笔记和划线
      let notes: WeReadNote[] = [];
      let bookmarks: WeReadBookmark[] = [];

      // 获取单本书的笔记和划线
      const allNotes = await wereadService.getReviews(
        wereadCookie.value,
        bookId
      );
      const allBookmarks = await wereadService.getBookmarks(
        wereadCookie.value,
        bookId
      );
      

      if (isIncremental) {
        // 增量同步：获取当前书籍的上次同步时间后的笔记和划线
        const bookLastSyncTime = await storageService.getBookLastSyncTime(
          bookId
        );

        console.log(
          `执行增量同步, 书籍《${book.title}》上次同步时间: ${new Date(
            bookLastSyncTime
          ).toLocaleString()}`
        );

        if (bookLastSyncTime > 0) {
          // 根据书籍上次同步时间过滤
          notes = allNotes.filter(
            (note) => note.createTime * 1000 > bookLastSyncTime
          );
          bookmarks = allBookmarks.filter(
            (bookmark) => bookmark.createTime * 1000 > bookLastSyncTime
          );
        } else {
          // 如果没有上次同步时间，则使用所有笔记和划线
          notes = allNotes;
          bookmarks = allBookmarks;
        }
      } else {
        // 全量同步：获取所有笔记和划线
        notes = allNotes;
        bookmarks = allBookmarks;
      }

      if (notes.length === 0 && bookmarks.length === 0) {
        return {
          success: true,
          message: "该书籍没有需要同步的笔记和划线",
          notesCount: 0,
          bookmarksCount: 0,
          book,
        };
      }

      // 同步历史记录
      const syncHistory: SyncHistory = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        notesCount: notes.length,
        bookmarksCount: bookmarks.length,
        success: true,
        message: "",
        bookIds: [book.bookId],
      };

      // 同步笔记和划线
      if (syncSettings.mergeNotes) {
        // 合并同步笔记和划线
        await this.syncMergedNotes(book, notes, bookmarks, writeathonSettings);
      } else {
        // 分别同步笔记和划线
        await this.syncSeparateNotes(
          book,
          notes,
          bookmarks,
          writeathonSettings
        );
      }

      // 更新同步历史
      syncHistory.message = `成功${isIncremental ? "增量" : ""}同步《${
        book.title
      }》的 ${notes.length} 条笔记和 ${bookmarks.length} 条划线`;
      await storageService.saveSyncHistory(syncHistory);

      // 更新当前书籍的最后同步时间
      if (notes.length > 0 || bookmarks.length > 0) {
        await storageService.saveBookLastSyncTime(bookId, Date.now());
      }

      return {
        success: true,
        message: syncHistory.message,
        notesCount: notes.length,
        bookmarksCount: bookmarks.length,
        book,
      };
    } catch (error: any) {
      console.error("同步单本书籍失败:", error);
      return {
        success: false,
        message: `同步失败: ${error.message || "未知错误"}`,
        notesCount: 0,
        bookmarksCount: 0,
      };
    }
  },
  // 执行同步
  async sync(
    isAutoSync: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 初始化同步进度
      await storageService.clearSyncProgress();
      // 更新同步进度
      updateSyncProgress({
        currentBook: 0,
        totalBooks: 0,
        currentBookTitle: "",
        isCompleted: false,
        isAutoSync,
      });

      // 获取设置
      const writeathonSettings = await storageService.getWriteathonSettings();
      const syncSettings = await storageService.getSyncSettings();
      const wereadCookie = await storageService.getWeReadCookie();

      // 检查设置是否完整
      if (!writeathonSettings.apiToken || !writeathonSettings.userId) {
        return {
          success: false,
          message: "请先设置Writeathon API Token和用户ID",
        };
      }

      if (!wereadCookie) {
        return { success: false, message: "请先登录微信读书" };
      }

      // 验证Writeathon凭证
      const isValidCredentials = await writeathonService.validateCredentials(
        writeathonSettings
      );
      if (!isValidCredentials) {
        return { success: false, message: "Writeathon API Token或用户ID无效" };
      }

      // 获取自动同步的书籍ID列表
      const autoSyncBookIds = await storageService.getAutoSyncBookIds();

      if (autoSyncBookIds.length === 0) {
        return { success: false, message: "请先手动同步书架上的书籍" };
      }

      // 获取书架中的所有书籍
      const allBooks = await wereadService.getBookshelf(wereadCookie.value);

      // 筛选出需要自动同步的书籍
      const booksToSync = allBooks.filter((book) =>
        autoSyncBookIds.includes(book.bookId)
      );

      if (booksToSync.length === 0) {
        return { success: false, message: "没有找到需要自动同步的书籍" };
      }

      // 初始化同步进度
      updateSyncProgress({
        currentBook: 0,
        totalBooks: booksToSync.length,
        currentBookTitle: "",
        isCompleted: false,
        isAutoSync,
      });

      let totalNotes = 0;
      let totalBookmarks = 0;
      let bookIds: string[] = [];
      // 逐本同步书籍
      for (let i = 0; i < booksToSync.length; i++) {
        const book = booksToSync[i];
        bookIds.push(book.bookId);
        // 更新同步进度
        updateSyncProgress({
          currentBook: i + 1,
          totalBooks: booksToSync.length,
          currentBookTitle: book.title,
          isCompleted: false,
          isAutoSync,
        });

        // 获取书籍的上次同步时间
        const lastSyncTime = await storageService.getBookLastSyncTime(
          book.bookId
        );

        // 增量同步书籍
        const result = await this.syncSingleBook(book.bookId, true);

        totalNotes += result.notesCount;
        totalBookmarks += result.bookmarksCount;
      }

      // 更新同步进度为完成
      updateSyncProgress({
        currentBook: booksToSync.length,
        totalBooks: booksToSync.length,
        currentBookTitle: "",
        isCompleted: true,
        isAutoSync,
      });

      // 保存同步历史记录
      await storageService.saveSyncHistory({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        notesCount: totalNotes,
        bookmarksCount: totalBookmarks,
        message: `自动同步了 ${booksToSync.length} 本书籍`,
        success: true,
        bookIds,
      });

      return {
        success: true,
        message: `自动同步完成，共同步了 ${booksToSync.length} 本书籍，${totalNotes} 条笔记，${totalBookmarks} 条划线`,
      };
    } catch (error: any) {
      console.error("同步失败:", error);
      return {
        success: false,
        message: `同步失败: ${error.message || "未知错误"}`,
      };
    }
  },

  // 处理笔记和划线
  async processNotesAndBookmarks(
    notes: WeReadNote[],
    bookmarks: WeReadBookmark[],
    booksMap: Map<string, WeReadBook>,
    writeathonSettings: { apiToken: string; userId: string },
    mergeNotes: boolean,
    isAutoSync: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 按书籍分组笔记和划线
      const bookNotesMap = new Map<
        string,
        { book: WeReadBook; notes: WeReadNote[]; bookmarks: WeReadBookmark[] }
      >();

      // 处理笔记
      for (const note of notes) {
        const book = booksMap.get(note.bookId);
        if (!book) continue;

        if (!bookNotesMap.has(note.bookId)) {
          bookNotesMap.set(note.bookId, { book, notes: [], bookmarks: [] });
        }

        bookNotesMap.get(note.bookId)?.notes.push(note);
      }

      // 处理划线
      for (const bookmark of bookmarks) {
        const book = booksMap.get(bookmark.bookId);
        if (!book) continue;

        if (!bookNotesMap.has(bookmark.bookId)) {
          bookNotesMap.set(bookmark.bookId, { book, notes: [], bookmarks: [] });
        }

        bookNotesMap.get(bookmark.bookId)?.bookmarks.push(bookmark);
      }

      // 同步到Writeathon
      let currentBookIndex = 0;
      const totalBooks = bookNotesMap.size;

      for (const [_, { book, notes, bookmarks }] of bookNotesMap.entries()) {
        // 更新当前同步进度
        currentBookIndex++;
        updateSyncProgress({
          currentBook: currentBookIndex,
          totalBooks: totalBooks,
          currentBookTitle: book.title,
          isCompleted: false,
          isAutoSync,
        });

        if (mergeNotes) {
          // 合并同一本书的笔记和划线
          await this.syncMergedNotes(
            book,
            notes,
            bookmarks,
            writeathonSettings
          );
        } else {
          // 分别同步笔记和划线
          await this.syncSeparateNotes(
            book,
            notes,
            bookmarks,
            writeathonSettings
          );
        }

        // 更新当前书籍的最后同步时间
        if (notes.length > 0 || bookmarks.length > 0) {
          await storageService.saveBookLastSyncTime(book.bookId, Date.now());
        }
      }

      return {
        success: true,
        message: `同步完成，共同步了 ${notes.length} 条笔记和 ${bookmarks.length} 条划线`,
      };
    } catch (error: any) {
      console.error("处理笔记和划线失败:", error);
      return {
        success: false,
        message: `处理笔记和划线失败: ${error.message || "未知错误"}`,
      };
    }
  },

  filterTitle: (title: string): string => {
    const maxLength = 50;
    // 过滤特殊字符
    title = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, "");
    if (title.length <= maxLength) {
      return title;
    }
    const halfLength = Math.floor(maxLength / 2);
    return title.substring(0, halfLength);
  },

  // 过滤内容
  filterContent: (content: string): string => {
    // 过滤段首空格和缩进
    content = content.replace(/^[\s\u3000]+/gm, "");
    return content;
  },

  // 合并同步笔记和划线
  async syncMergedNotes(
    book: WeReadBook,
    notes: WeReadNote[],
    bookmarks: WeReadBookmark[],
    writeathonSettings: { apiToken: string; userId: string }
  ): Promise<void> {
    if (notes.length === 0 && bookmarks.length === 0) return;

    // 构建标题
    const title = `${book.title} - 笔记与划线`;

    // 检查书籍是否首次同步
    const isFirstSync = !(await storageService.isBookSynced(book.bookId));

    // 构建内容
    let content = "";

    if (isFirstSync) {
      // 首次同步：添加标签
      content += `#微信读书/${this.filterTitle(book.title)} \n\n`;
      // 首次同步：添加书籍链接
      content += `[微信读书](${wereadService.getUrl(book.bookId)})\n\n`;
    } else {
      // 非首次同步：添加创建日期
      const currentDate = new Date().toISOString().split("T")[0];
      content += `### ${currentDate}\n\n`;
    }

    // 添加笔记
    if (notes.length > 0) {
      content += `### 笔记\n\n`;
      notes.forEach((note) => {
        content += `> ${this.filterContent(
          note.markText
        )}\n\n${this.filterContent(note.content)}\n\n---\n\n`;
      });
    }

    // 添加划线
    if (bookmarks.length > 0) {
      content += `### 划线\n\n`;
      bookmarks.forEach((bookmark) => {
        content += `> ${this.filterContent(bookmark.markText)}\n\n---\n\n`;
      });
    }

    // 同步到Writeathon
    await writeathonService.createCard(writeathonSettings, title, content);

    // 保存书籍ID
    await storageService.saveSyncedBookId(book.bookId);
  },

  // 分别同步笔记和划线
  async syncSeparateNotes(
    book: WeReadBook,
    notes: WeReadNote[],
    bookmarks: WeReadBookmark[],
    writeathonSettings: { apiToken: string; userId: string }
  ): Promise<void> {
    // 同步笔记
    for (const note of notes) {
      const title = `${book.title} - 笔记: ${note.markText.substring(
        0,
        CRAD_TITLE_MAX_LENGTH
      )}${note.markText.length > CRAD_TITLE_MAX_LENGTH ? "..." : ""}`;

      let content = "";

      //添加标签和书籍链接
      content += `#微信读书/${this.filterTitle(book.title)} \n\n`;
      content += `[微信读书](${wereadService.getUrl(book.bookId)})\n\n`;

      content += `> ${this.filterContent(
        note.markText
      )}\n\n${this.filterContent(note.content)}\n\n`;

      await writeathonService.createCard(writeathonSettings, title, content);
    }

    // 同步划线
    for (const bookmark of bookmarks) {
      const title = `${book.title} - 划线: ${bookmark.markText.substring(
        0,
        CRAD_TITLE_MAX_LENGTH
      )}${bookmark.markText.length > CRAD_TITLE_MAX_LENGTH ? "..." : ""}`;

      let content = "";
      // 首次同步：添加标签和书籍链接
      content += `#微信读书/${this.filterTitle(book.title)} \n\n`;
      content += `[微信读书](${wereadService.getUrl(book.bookId)})\n\n`;

      content += `> ${this.filterContent(bookmark.markText)}\n\n`;

      await writeathonService.createCard(writeathonSettings, title, content);
    }

    // 保存书籍ID
    await storageService.saveSyncedBookId(book.bookId);
  },
};
