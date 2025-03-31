import { v4 as uuidv4 } from "uuid";
import { storageService } from "./storage";
import { wereadService } from "./weread";
import { writeathonService } from "./writeathon";
import { SyncHistory, WeReadBook, WeReadBookmark, WeReadNote } from "../types";

// 同步服务
export const syncService = {
  // 执行同步
  async sync(): Promise<{ success: boolean; message: string }> {
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

      // 获取最近的笔记和划线
      const { notes, bookmarks } = await wereadService.getRecentNotes(
        wereadCookie,
        syncSettings.syncRange
      );

      if (notes.length === 0 && bookmarks.length === 0) {
        return { success: true, message: "没有找到需要同步的笔记和划线" };
      }

      // 获取所有书籍信息
      const books = await wereadService.getBooks(wereadCookie);
      const booksMap = new Map<string, WeReadBook>();
      books.forEach((book) => booksMap.set(book.bookId, book));

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

      // 更新同步历史
      syncHistory.success = syncResults.success;
      syncHistory.message = syncResults.message;

      // 保存同步历史
      await storageService.saveSyncHistory(syncHistory);

      return {
        success: syncResults.success,
        message: syncResults.message,
      };
    } catch (error) {
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

        bookNotesMap.get(note.bookId).notes.push(note);
      }

      // 处理划线
      for (const bookmark of bookmarks) {
        const book = booksMap.get(bookmark.bookId);
        if (!book) continue;

        if (!bookNotesMap.has(bookmark.bookId)) {
          bookNotesMap.set(bookmark.bookId, { book, notes: [], bookmarks: [] });
        }

        bookNotesMap.get(bookmark.bookId).bookmarks.push(bookmark);
      }

      // 同步到Writeathon
      for (const [_, { book, notes, bookmarks }] of bookNotesMap.entries()) {
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
    } catch (error) {
      console.error("处理笔记和划线失败:", error);
      return {
        success: false,
        message: `处理笔记和划线失败: ${error.message || "未知错误"}`,
      };
    }
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
      if (book.category) {
        content += `#${book.category} `;
      }
      content += `#${book.title} \n\n`;
      content += `[${book.title}](${wereadService.getUrl(book.bookId)})\n\n`;
    } else {
      // 非首次同步：添加创建日期
      const currentDate = new Date().toISOString().split("T")[0];
      content += `### ${currentDate}\n\n`;
    }

    content += `## ${book.title}\n\n`;

    // 添加笔记
    if (notes.length > 0) {
      content += "### 笔记\n\n";
      notes.forEach((note) => {
        content += `> ${note.markText}\n\n${note.content}\n\n---\n\n`;
      });
    }

    // 添加划线
    if (bookmarks.length > 0) {
      content += "### 划线\n\n";
      bookmarks.forEach((bookmark) => {
        content += `> ${bookmark.markText}\n\n`;
      });
    }

    // 非首次同步：在内容末尾添加分隔符
    if (!isFirstSync) {
      content += "\n\n---\n\n";
    } else {
      // 首次同步：添加标签
      content += `\n#${book.title} `;
      if (book.category) {
        content += `#${book.category} `;
      }
    }

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

      if (isFirstSync) {
        // 首次同步：添加标签和书籍链接
        if (book.category) {
          content += `#${book.category} `;
        }
        content += `#${book.title} \n\n`;
        content += `微信阅读：[${book.title}](${wereadService.getUrl(
          book.bookId
        )})\n\n`;
      }
      // 添加创建日期
      content += `### ${currentDate}\n\n`;

      content += `> ${note.markText}\n\n${note.content}\n\n`;

      // 在内容末尾添加分隔符
      content += "---\n\n";

      await writeathonService.createCard(writeathonSettings, title, content);
    }

    // 同步划线
    if (bookmarks.length > 0) {
      const title = `${book.title} - 划线集`;

      let content = "";

      if (isFirstSync) {
        // 首次同步：添加标签和书籍链接
        if (book.category) {
          content += `#${book.category} `;
        }
        content += `#${book.title} \n\n`;
        content += `微信阅读：[${book.title}](${wereadService.getUrl(
          book.bookId
        )})\n\n`;
      }
      // 添加创建日期
      content += `### ${currentDate}\n\n`;

      bookmarks.forEach((bookmark) => {
        content += `> ${bookmark.markText}\n\n`;
      });

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
