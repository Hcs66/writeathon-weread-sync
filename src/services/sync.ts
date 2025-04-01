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

// 更新同步进度
const updateSyncProgress = (progress: SyncProgress) => {
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
    bookId: string
  ): Promise<{ success: boolean; message: string }> {
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

      // 获取书籍详情
      const book = await wereadService.getBookDetail(
        wereadCookie.value,
        bookId
      );
      if (!book) {
        return { success: false, message: "获取书籍详情失败" };
      }

      // 获取书籍的笔记和划线
      const notes = await wereadService.getNotes(wereadCookie.value, bookId);
      const bookmarks = await wereadService.getBookmarks(
        wereadCookie.value,
        bookId
      );

      if (notes.length === 0 && bookmarks.length === 0) {
        return { success: true, message: "该书籍没有笔记和划线" };
      }

      // 同步历史记录
      const syncHistory: SyncHistory = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        notesCount: notes.length,
        bookmarksCount: bookmarks.length,
        success: true,
        message: "",
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
      syncHistory.message = `成功同步《${book.title}》的 ${notes.length} 条笔记和 ${bookmarks.length} 条划线`;
      await storageService.saveSyncHistory(syncHistory);

      return {
        success: true,
        message: syncHistory.message,
      };
    } catch (error: any) {
      console.error("同步单本书籍失败:", error);
      return {
        success: false,
        message: `同步失败: ${error.message || "未知错误"}`,
      };
    }
  },
  // 执行同步
  async sync(): Promise<{ success: boolean; message: string }> {
    try {
      // 初始化同步进度
      await storageService.clearSyncProgress();
      updateSyncProgress({
        currentBook: 0,
        totalBooks: 0,
        currentBookTitle: "",
        isCompleted: false,
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

      // 获取最近的笔记和划线（使用上次同步时间进行增量同步）
      const { notes, bookmarks } = await wereadService.getRecentNotes(
        wereadCookie.value,
        syncSettings.syncRange,
        syncSettings.lastSyncTime
      );

      if (notes.length === 0 && bookmarks.length === 0) {
        return { success: true, message: "没有找到需要同步的书籍" };
      }

      // 获取所有书籍信息
      const books = await wereadService.getBooks(wereadCookie.value);
      const booksMap = new Map<string, WeReadBook>();
      books.forEach((book) => booksMap.set(book.bookId, book));

      // 更新总书籍数量
      updateSyncProgress({
        currentBook: 0,
        totalBooks: booksMap.size,
        currentBookTitle: "",
        isCompleted: false,
      });

      // 同步历史记录
      const syncHistory: SyncHistory = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        notesCount: notes.length,
        bookmarksCount: bookmarks.length,
        success: true,
        message: "",
      };

      // 处理笔记和划线
      const syncResults = await this.processNotesAndBookmarks(
        notes,
        bookmarks,
        booksMap,
        writeathonSettings,
        syncSettings.mergeNotes
      );

      // 更新同步进度为完成
      updateSyncProgress({
        currentBook: booksMap.size,
        totalBooks: booksMap.size,
        currentBookTitle: "",
        isCompleted: true,
      });

      // 更新同步历史
      syncHistory.success = syncResults.success;
      syncHistory.message = syncResults.message;

      // 保存同步历史
      await storageService.saveSyncHistory(syncHistory);

      // 更新上次同步时间
      syncSettings.lastSyncTime = Date.now();
      await storageService.saveSyncSettings(syncSettings);

      return {
        success: syncResults.success,
        message: syncResults.message,
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
    mergeNotes: boolean
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
      // 首次同步：添加标签和书籍链接
      content += `#微信读书/${this.filterTitle(book.title)} \n\n`;
      content += `微信读书：[${book.title}](${wereadService.getUrl(
        book.bookId
      )})\n\n`;
    } else {
      // 非首次同步：添加创建日期
      const currentDate = new Date().toISOString().split("T")[0];
      content += `### ${currentDate}\n\n`;
    }

    content += `## ${book.title}\n\n`;

    // 添加笔记
    if (notes.length > 0) {
      notes.forEach((note) => {
        content += `> ${this.filterContent(
          note.markText
        )}\n\n${this.filterContent(note.content)}\n\n---\n\n`;
      });
    }

    // 添加划线
    if (bookmarks.length > 0) {
      bookmarks.forEach((bookmark) => {
        content += `> ${this.filterContent(bookmark.markText)}\n\n`;
      });
    }

    // 在内容末尾添加分隔符
    content += "\n\n---\n\n";

    // 同步到Writeathon
    await writeathonService.createCard(writeathonSettings, title, content);

    // 如果是首次同步，保存书籍ID
    if (isFirstSync) {
      await storageService.saveSyncedBookId(book.bookId);
    }
  },

  // 分别同步笔记和划线
  async syncSeparateNotes(
    book: WeReadBook,
    notes: WeReadNote[],
    bookmarks: WeReadBookmark[],
    writeathonSettings: { apiToken: string; userId: string }
  ): Promise<void> {
    // 检查书籍是否首次同步
    const isFirstSync = !(await storageService.isBookSynced(book.bookId));
    const currentDate = new Date().toISOString().split("T")[0];

    // 同步笔记
    for (const note of notes) {
      const title = `${book.title} - 笔记: ${note.markText.substring(0, 20)}${
        note.markText.length > 20 ? "..." : ""
      }`;

      let content = "";

      //添加标签和书籍链接
      content += `#微信读书/${this.filterTitle(book.title)} \n\n`;
      content += `微信读书：[${book.title}](${wereadService.getUrl(
        book.bookId
      )})\n\n`;

      // 添加创建日期
      content += `### ${currentDate}\n\n`;

      content += `> ${this.filterContent(
        note.markText
      )}\n\n${this.filterContent(note.content)}\n\n`;

      // 在内容末尾添加分隔符
      content += "---\n\n";

      await writeathonService.createCard(writeathonSettings, title, content);
    }

    // 同步划线
    for (const bookmark of bookmarks) {
      const title = `${book.title} - 划线: ${bookmark.markText.substring(
        0,
        20
      )}${bookmark.markText.length > 20 ? "..." : ""}`;

      console.log(title);
      
      let content = "";
      // 首次同步：添加标签和书籍链接
      content += `#微信读书/${this.filterTitle(book.title)} \n\n`;
      content += `微信读书：[${book.title}](${wereadService.getUrl(
        book.bookId
      )})\n\n`;

      // 添加创建日期
      content += `### ${currentDate}\n\n`;

      content += `> ${this.filterContent(bookmark.markText)}\n\n`;

      // 在内容末尾添加分隔符
      content += "---\n\n";

      await writeathonService.createCard(writeathonSettings, title, content);
    }

    // 如果是首次同步，保存书籍ID
    if (isFirstSync) {
      await storageService.saveSyncedBookId(book.bookId);
    }
  },
};
