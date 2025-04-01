import { WeReadBook, WeReadNote, WeReadBookmark } from "../types";
import * as CryptoJS from "crypto-js";
import { storageService } from "./storage";

// 微信读书API基础URL
const WEREAD_URL = "https://weread.qq.com/";
const API_BASE_URL = "https://i.weread.qq.com";
const WEREAD_NOTEBOOKS_URL = `${API_BASE_URL}/user/notebooks`;
const WEREAD_BOOKMARKLIST_URL = `${API_BASE_URL}/book/bookmarklist`;
const WEREAD_CHAPTER_INFO = `${API_BASE_URL}/book/chapterInfos`;
const WEREAD_READ_INFO_URL = `${API_BASE_URL}/book/readinfo`;
const WEREAD_REVIEW_LIST_URL = `${API_BASE_URL}/review/list`;
const WEREAD_BOOK_INFO = `${API_BASE_URL}/book/info`;
const WEREAD_READDATA_DETAIL = `${API_BASE_URL}/readdata/detail`;
const WEREAD_HISTORY_URL = `${API_BASE_URL}/readdata/summary?synckey=0`;

// 延迟函数
const delay = async (ms?: number): Promise<void> => {
  // 如果没有提供延迟时间，则从存储中获取
  if (ms === undefined) {
    const syncSettings = await storageService.getSyncSettings();
    ms = syncSettings.requestDelay;
  }
  
  // 添加一个小的随机延迟，避免请求过于规律
  const randomDelay = Math.floor(Math.random() * 100); // 0-200ms的随机延迟
  const totalDelay = ms + randomDelay;
  
  await new Promise((resolve) => setTimeout(resolve, totalDelay));
};

// 重试函数装饰器
const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  waitTime = 5000
): Promise<T> => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Maximum retry attempts reached");
};

// 微信读书服务
export const wereadService = {
  // 处理错误码
  handleErrcode(errcode: number): void {
    if (errcode === -2012 || errcode === -2010) {
      console.error("微信读书Cookie过期了，请参考文档重新设置。");
    }
  },

  // 解析Cookie字符串
  parseCookieString(cookieStr: string): Record<string, string> {
    const cookiesDict: Record<string, string> = {};

    // 使用正则表达式解析cookie字符串
    const pattern = /([^=]+)=([^;]+);?\s*/g;
    let match;

    while ((match = pattern.exec(cookieStr)) !== null) {
      const [, key, value] = match;
      cookiesDict[key] = value;
    }

    return cookiesDict;
  },

  // 转换书籍ID
  transformId(bookId: string): [string, string[]] {
    const idLength = bookId.length;

    // 如果书籍ID全部是数字
    if (/^\d*$/.test(bookId)) {
      const ary: string[] = [];
      for (let i = 0; i < idLength; i += 9) {
        ary.push(
          parseInt(bookId.substring(i, Math.min(i + 9, idLength))).toString(16)
        );
      }
      return ["3", ary];
    }

    // 如果书籍ID包含非数字字符
    let result = "";
    for (let i = 0; i < idLength; i++) {
      result += bookId.charCodeAt(i).toString(16);
    }
    return ["4", [result]];
  },

  // 计算书籍字符串ID
  calculateBookStrId(bookId: string): string {
    // 计算MD5哈希
    const md5Digest = CryptoJS.MD5(bookId).toString();
    let result = md5Digest.substring(0, 3);

    // 转换ID
    const [code, transformedIds] = this.transformId(bookId);
    result += code + "2" + md5Digest.slice(-2);

    // 处理转换后的ID
    for (let i = 0; i < transformedIds.length; i++) {
      let hexLengthStr = transformedIds[i].length.toString(16);
      if (hexLengthStr.length === 1) {
        hexLengthStr = "0" + hexLengthStr;
      }

      result += hexLengthStr + transformedIds[i];

      if (i < transformedIds.length - 1) {
        result += "g";
      }
    }

    // 如果结果长度小于20，用MD5哈希填充
    if (result.length < 20) {
      result += md5Digest.substring(0, 20 - result.length);
    }

    // 添加最终的MD5哈希
    const finalMd5 = CryptoJS.MD5(result).toString();
    result += finalMd5.substring(0, 3);

    return result;
  },

  // 获取书籍URL
  getUrl(bookId: string): string {
    return `https://weread.qq.com/web/reader/${this.calculateBookStrId(
      bookId
    )}`;
  },

  // 获取用户信息
  async getUserInfo(cookie: string): Promise<any | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        const errcode = data.errcode || 0;
        this.handleErrcode(errcode);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("获取微信读书用户信息失败:", error);
      return null;
    }
  },

  // 获取书籍分类
  getCategory(categories: any[]): string {
    if (!categories || !categories.length) return "";
    const categoryNames = categories.map((category: any) => category.title);
    return categoryNames.join("|");
  },

  // 获取我的书架
  async getBookshelf(cookie: string): Promise<WeReadBook[]> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        const response = await fetch(
          `${API_BASE_URL}/shelf/sync?synckey=0&teenmode=0&album=1&onlyBookid=0`,
          {
            method: "GET",
            headers: {
              Cookie: cookie,
            },
          }
        );
        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          throw new Error(`Could not get bookshelf: ${JSON.stringify(data)}`);
        }
        const data = await response.json();
        const books = data.books || [];
        console.log(books);

        books.sort((a: any, b: any) => a.sort - b.sort);
        return books.map((item: any) => ({
          bookId: item.bookId,
          title: item.title,
          author: item.author,
          cover: item.cover,
          category: this.getCategory(item.categories),
        }));
      } catch (error) {
        console.error("获取微信读书书架失败:", error);
        throw error;
      }
    });
  },

  // 获取书籍列表
  async getBooks(cookie: string): Promise<WeReadBook[]> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        // 使用正确的API端点获取书架信息
        const response = await fetch(WEREAD_NOTEBOOKS_URL, {
          method: "GET",
          headers: {
            Cookie: cookie,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          throw new Error(`Could not get bookshelf: ${JSON.stringify(data)}`);
        }

        const data = await response.json();

        if (!data.books) return [];

        return data.books.map((item: any) => ({
          bookId: item.book.bookId,
          title: item.book.title,
          author: item.book.author,
          cover: item.book.cover,
          category: this.getCategory(item.book.categories),
        }));
      } catch (error) {
        console.error("获取微信读书书籍列表失败:", error);
        throw error;
      }
    });
  },

  // 获取笔记本列表
  async getNotebookList(cookie: string): Promise<any[]> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        const response = await fetch(WEREAD_NOTEBOOKS_URL, {
          method: "GET",
          headers: {
            Cookie: cookie,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          throw new Error(
            `Could not get notebook list: ${JSON.stringify(data)}`
          );
        }

        const data = await response.json();
        const books = data.books || [];
        books.sort((a: any, b: any) => a.sort - b.sort);
        return books;
      } catch (error) {
        console.error("获取笔记本列表失败:", error);
        throw error;
      }
    });
  },

  // 获取书籍详情
  async getBookDetail(
    cookie: string,
    bookId: string
  ): Promise<WeReadBook | null> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        const response = await fetch(`${WEREAD_BOOK_INFO}?bookId=${bookId}`, {
          method: "GET",
          headers: {
            Cookie: cookie,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          console.error(`Could not get book info: ${JSON.stringify(data)}`);
          return null;
        }

        const book = await response.json();
        return {
          bookId: book.bookId,
          title: book.title,
          author: book.author,
          cover: book.cover,
          category: this.getCategory(book.categories),
        };
      } catch (error) {
        console.error("获取微信读书书籍详情失败:", error);
        return null;
      }
    });
  },

  // 获取笔记列表
  async getNotes(cookie: string, bookId: string): Promise<WeReadNote[]> {
    return await retry(async () => {
      try {
        // 获取笔记列表
        const reviews = await this.getReviewList(cookie, bookId);

        if (!reviews || !reviews.length) return [];

        // 处理笔记数据
        return (
          reviews.map((review: any) => ({
            bookId,
            chapterUid: review.chapterUid,
            createTime: review.createTime,
            markText: review.abstract || "",
            content: review.content || "",
            noteId: review.reviewId,
          })) || []
        );
      } catch (error) {
        console.error("获取微信读书笔记列表失败:", error);
        throw error;
      }
    });
  },

  // 获取书评列表
  async getReviewList(cookie: string, bookId: string): Promise<any[]> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        const params = new URLSearchParams({
          bookId,
          listType: "11",
          mine: "1",
          syncKey: "0",
        });

        const response = await fetch(`${WEREAD_REVIEW_LIST_URL}?${params}`, {
          method: "GET",
          headers: {
            Cookie: cookie,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          throw new Error(
            `get ${bookId} review list failed: ${JSON.stringify(data)}`
          );
        }

        const data = await response.json();
        const reviews = data.reviews || [];

        // 处理评论数据
        return reviews
          .map((item: any) => item.review)
          .map((review: any) => {
            if (review.type === 4) {
              return { chapterUid: 1000000, ...review };
            }
            return review;
          });
      } catch (error) {
        console.error(`获取书评列表失败:`, error);
        throw error;
      }
    });
  },

  // 获取章节信息
  async getChapterInfo(
    cookie: string,
    bookId: string
  ): Promise<Record<string, any>> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        const body = {
          bookIds: [bookId],
          synckeys: [0],
          teenmode: 0,
        };

        const response = await fetch(WEREAD_CHAPTER_INFO, {
          method: "POST",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          throw new Error(
            `get ${bookId} chapter info failed: ${JSON.stringify(data)}`
          );
        }

        const data = await response.json();

        if (data.data && data.data.length === 1 && data.data[0].updated) {
          const update = [...data.data[0].updated];
          update.push({
            chapterUid: 1000000,
            chapterIdx: 1000000,
            updateTime: 1683825006,
            readAhead: 0,
            title: "点评",
            level: 1,
          });

          // 转换为对象格式
          const result: Record<string, any> = {};
          for (const item of update) {
            result[item.chapterUid] = item;
          }

          return result;
        } else {
          throw new Error(
            `get ${bookId} chapter info failed: ${JSON.stringify(data)}`
          );
        }
      } catch (error) {
        console.error(`获取章节信息失败:`, error);
        throw error;
      }
    });
  },

  // 获取阅读信息
  async getReadInfo(cookie: string, bookId: string): Promise<any> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        const params = new URLSearchParams({
          noteCount: "1",
          readingDetail: "1",
          finishedBookIndex: "1",
          readingBookCount: "1",
          readingBookIndex: "1",
          finishedBookCount: "1",
          bookId,
          finishedDate: "1",
        });

        const headers = {
          Cookie: cookie,
          baseapi: "32",
          appver: "8.2.5.10163885",
          basever: "8.2.5.10163885",
          osver: "12",
          "User-Agent":
            "WeRead/8.2.5 WRBrand/xiaomi Dalvik/2.1.0 (Linux; U; Android 12; Redmi Note 7 Pro Build/SQ3A.220705.004)",
        };

        const response = await fetch(`${WEREAD_READ_INFO_URL}?${params}`, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          throw new Error(
            `get ${bookId} read info failed: ${JSON.stringify(data)}`
          );
        }

        return await response.json();
      } catch (error) {
        console.error(`获取阅读信息失败:`, error);
        throw error;
      }
    });
  },

  // 获取历史数据
  async getApiData(cookie: string): Promise<any> {
    try {
      // 添加请求延迟
      await delay();
      
      const response = await fetch(WEREAD_HISTORY_URL, {
        method: "GET",
        headers: {
          Cookie: cookie,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        const errcode = data.errcode || 0;
        this.handleErrcode(errcode);
        throw new Error(`get history data failed: ${JSON.stringify(data)}`);
      }

      return await response.json();
    } catch (error) {
      console.error("获取历史数据失败:", error);
      throw error;
    }
  },

  // 获取划线列表
  async getBookmarks(
    cookie: string,
    bookId: string
  ): Promise<WeReadBookmark[]> {
    return await retry(async () => {
      try {
        // 添加请求延迟
        await delay();
        
        const response = await fetch(
          `${WEREAD_BOOKMARKLIST_URL}?bookId=${bookId}`,
          {
            method: "GET",
            headers: {
              Cookie: cookie,
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          const errcode = data.errcode || 0;
          this.handleErrcode(errcode);
          throw new Error(
            `Could not get ${bookId} bookmark list: ${JSON.stringify(data)}`
          );
        }

        const data = await response.json();

        if (!data.updated || !data.updated.length) return [];

        // 筛选纯划线（没有笔记内容的标记）
        return data.updated.map((bookmark: any) => ({
          bookId,
          chapterUid: bookmark.chapterUid,
          createTime: bookmark.createTime,
          markText: bookmark.markText,
          bookmarkId: bookmark.bookmarkId,
        }));
      } catch (error) {
        console.error("获取微信读书划线列表失败:", error);
        throw error;
      }
    });
  },

  // 获取最近的笔记和划线
  async getRecentNotes(
    cookie: string,
    syncRange: "last1days" | "last7days" | "last14days" | "last30days" | "all",
    lastSyncTime?: number
  ): Promise<{ notes: WeReadNote[]; bookmarks: WeReadBookmark[] }> {
    try {
      // 获取所有书籍
      const books = await this.getBooks(cookie);

      if (!books.length) {
        console.log("没有找到任何书籍");
        return { notes: [], bookmarks: [] };
      }

      console.log(`找到 ${books.length} 本书`);

      const allNotes: WeReadNote[] = [];
      const allBookmarks: WeReadBookmark[] = [];

      // 获取每本书的笔记和划线
      for (const book of books) {
        console.log(`处理书籍: ${book.title} (${book.bookId})`);
        
        const notes = await this.getNotes(cookie, book.bookId);
        
        // 在获取笔记和划线之间添加额外延迟
        await delay(500);
        
        const bookmarks = await this.getBookmarks(cookie, book.bookId);

        console.log(
          `- 找到 ${notes.length} 条笔记和 ${bookmarks.length} 条划线`
        );

        allNotes.push(...notes);
        allBookmarks.push(...bookmarks);
      }

      // 根据同步范围或上次同步时间过滤
      if (lastSyncTime && lastSyncTime > 0) {
        // 如果有上次同步时间，优先使用增量同步
        console.log(
          `使用增量同步，上次同步时间: ${new Date(
            lastSyncTime
          ).toLocaleString()}`
        );

        // 微信读书时间戳是秒级别的，需要转换为毫秒进行比较
        const filteredNotes = allNotes.filter(
          (note) => note.createTime * 1000 > lastSyncTime
        );
        const filteredBookmarks = allBookmarks.filter(
          (bookmark) => bookmark.createTime * 1000 > lastSyncTime
        );

        console.log(
          `增量同步找到 ${filteredNotes.length} 条笔记和 ${filteredBookmarks.length} 条划线`
        );
        return { notes: filteredNotes, bookmarks: filteredBookmarks };
      } else if (syncRange !== "all") {
        // 如果没有上次同步时间，使用同步范围过滤
        const now = Date.now();
        let timeRange: number;

        switch (syncRange) {
          case "last1days":
            timeRange = 1 * 24 * 60 * 60 * 1000;
            break;
          case "last7days":
            timeRange = 7 * 24 * 60 * 60 * 1000;
            break;
          case "last14days":
            timeRange = 14 * 24 * 60 * 60 * 1000;
            break;
          case "last30days":
            timeRange = 30 * 24 * 60 * 60 * 1000;
            break;
        }

        // 微信读书时间戳是秒级别的，需要转换为毫秒
        const filteredNotes = allNotes.filter(
          (note) => now - note.createTime * 1000 <= timeRange
        );
        const filteredBookmarks = allBookmarks.filter(
          (bookmark) => now - bookmark.createTime * 1000 <= timeRange
        );

        return { notes: filteredNotes, bookmarks: filteredBookmarks };
      }

      return { notes: allNotes, bookmarks: allBookmarks };
    } catch (error) {
      console.error("获取最近的笔记和划线失败:", error);
      return { notes: [], bookmarks: [] };
    }
  },
};
