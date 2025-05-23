<script lang="ts" setup>
  import { ref, onMounted, computed } from "vue";
  import { Icon } from "@iconify/vue";
  import { storageService } from "@/services/storage";
  import { wereadService } from "@/services/weread";
  import { syncService } from "@/services/sync";
  import { WeReadBook, WeReadNote, WeReadBookmark } from "@/types";

  interface SyncedBookData extends WeReadBook {
    notesCount: number;
    bookmarksCount: number;
    lastSyncTime?: string;
  }

  // 标签页
  const activeTab = ref<"synced" | "bookshelf">("synced");

  // 已同步书籍数据
  const syncedBooks = ref<SyncedBookData[]>([]);
  const isSyncedLoading = ref(true);
  const syncedErrorMessage = ref("");

  // 书架数据
  interface BookshelfBookData extends WeReadBook {
    isSynced: boolean;
    notesCount?: number;
    bookmarksCount?: number;
  }
  const bookshelfBooks = ref<BookshelfBookData[]>([]);
  const isBookshelfLoading = ref(true);
  const bookshelfErrorMessage = ref("");

  // 同步状态
  const syncingBookId = ref<string | null>(null);
  const syncResult = ref<{ success: boolean; message: string } | null>(null);

  // 分页相关 - 已同步书籍
  const syncedCurrentPage = ref(1);
  const pageSize = 10; // 每页显示10本书
  const syncedTotalPages = ref(0);

  // 分页相关 - 书架
  const bookshelfCurrentPage = ref(1);
  const bookshelfTotalPages = ref(0);

  // 获取已同步的书籍数据
  const loadSyncedBooks = async () => {
    isSyncedLoading.value = true;
    syncedErrorMessage.value = "";

    try {
      // 获取已同步的书籍ID列表
      const syncedBookIds = await storageService.getSyncedBookIds();

      if (syncedBookIds.length === 0) {
        syncedBooks.value = [];
        syncedTotalPages.value = 0;
        return;
      }

      // 获取微信读书Cookie
      const wereadCookie = await storageService.getWeReadCookie();

      if (!wereadCookie) {
        syncedErrorMessage.value = "请先登录微信读书";
        return;
      }

      // 获取所有书籍信息
      const allBooks = await wereadService.getBooks(wereadCookie.value);

      // 筛选已同步的书籍
      const synced: SyncedBookData[] = [];

      for (const book of allBooks) {
        if (syncedBookIds.includes(book.bookId)) {
          // 添加延迟，避免短时间内发送大量请求
          await new Promise((resolve) => setTimeout(resolve, 100));

          // 获取笔记和划线数量
          const notes = await wereadService.getNotes(
            wereadCookie.value,
            book.bookId
          );

          // 在获取笔记和划线之间添加额外延迟
          await new Promise((resolve) => setTimeout(resolve, 100));

          const bookmarks = await wereadService.getBookmarks(
            wereadCookie.value,
            book.bookId
          );

          synced.push({
            ...book,
            notesCount: notes.length,
            bookmarksCount: bookmarks.length,
            lastSyncTime: new Date().toISOString().split("T")[0], // 使用当前日期作为最后同步时间
          });
        }
      }

      syncedBooks.value = synced;
      syncedTotalPages.value = Math.ceil(synced.length / pageSize);
    } catch (error) {
      console.error("加载已同步书籍数据失败:", error);
      syncedErrorMessage.value = "加载已同步书籍数据失败";
    } finally {
      isSyncedLoading.value = false;
    }
  };

  // 获取书架数据
  const loadBookshelf = async () => {
    isBookshelfLoading.value = true;
    bookshelfErrorMessage.value = "";

    try {
      // 获取微信读书Cookie
      const wereadCookie = await storageService.getWeReadCookie();

      if (!wereadCookie) {
        bookshelfErrorMessage.value = "请先登录微信读书";
        return;
      }

      // 获取已同步的书籍ID列表
      const syncedBookIds = await storageService.getSyncedBookIds();

      // 获取书架数据
      const books = await wereadService.getBookshelf(wereadCookie.value);

      // 为每本书添加同步状态
      const booksWithSyncStatus: BookshelfBookData[] = [];

      for (const book of books) {
        const isSynced = syncedBookIds.includes(book.bookId);
        const bookData: BookshelfBookData = {
          ...book,
          isSynced,
        };

        // 如果已同步，获取笔记和划线数量
        if (isSynced) {
          try {
            // 添加延迟，避免短时间内发送大量请求
            await new Promise((resolve) => setTimeout(resolve, 100));

            const notes = await wereadService.getNotes(
              wereadCookie.value,
              book.bookId
            );

            // 在获取笔记和划线之间添加额外延迟
            await new Promise((resolve) => setTimeout(resolve, 100));

            const bookmarks = await wereadService.getBookmarks(
              wereadCookie.value,
              book.bookId
            );

            bookData.notesCount = notes.length;
            bookData.bookmarksCount = bookmarks.length;
          } catch (error) {
            console.error(
              `获取书籍 ${book.title} 的笔记和划线数量失败:`,
              error
            );
          }
        }

        booksWithSyncStatus.push(bookData);
      }

      bookshelfBooks.value = booksWithSyncStatus;
      bookshelfTotalPages.value = Math.ceil(
        booksWithSyncStatus.length / pageSize
      );
    } catch (error) {
      console.error("加载书架数据失败:", error);
      bookshelfErrorMessage.value = "加载书架数据失败";
    } finally {
      isBookshelfLoading.value = false;
    }
  };

  // 同步单本书籍
  const syncBook = async (bookId: string) => {
    syncingBookId.value = bookId;
    syncResult.value = null;

    try {
      // 调用同步服务
      const result = await syncService.syncSingleBook(bookId);
      syncResult.value = result;

      // 如果同步成功，重新加载已同步书籍数据
      if (result.success) {
        await loadSyncedBooks();
      }
    } catch (error: any) {
      console.error("同步书籍失败:", error);
      syncResult.value = {
        success: false,
        message: `同步失败: ${error.message || "未知错误"}`,
      };
    } finally {
      syncingBookId.value = null;
    }
  };

  // 获取当前页的已同步书籍
  const paginatedSyncedBooks = computed(() => {
    const start = (syncedCurrentPage.value - 1) * pageSize;
    const end = start + pageSize;
    return syncedBooks.value.slice(start, end);
  });

  // 获取当前页的书架书籍
  const paginatedBookshelfBooks = computed(() => {
    const start = (bookshelfCurrentPage.value - 1) * pageSize;
    const end = start + pageSize;
    return bookshelfBooks.value.slice(start, end);
  });

  // 切换已同步书籍页面
  const goToSyncedPage = (page: number) => {
    if (page >= 1 && page <= syncedTotalPages.value) {
      syncedCurrentPage.value = page;
    }
  };

  // 切换书架页面
  const goToBookshelfPage = (page: number) => {
    if (page >= 1 && page <= bookshelfTotalPages.value) {
      bookshelfCurrentPage.value = page;
    }
  };

  // 切换标签页
  const switchTab = (tab: "synced" | "bookshelf") => {
    activeTab.value = tab;

    // 如果切换到书架标签页且数据为空，则加载书架数据
    if (tab === "bookshelf" && bookshelfBooks.value.length === 0) {
      loadBookshelf();
    }
  };

  // 组件挂载时加载已同步书籍数据
  onMounted(loadSyncedBooks);

  // 计算属性：转换封面图片URL
  const bookCover = computed(() => (cover: string) => {
    // 替换封面图片URL中的"s_"为"t6"，以获取更清晰的图片
    const index = cover.lastIndexOf("s_");
    if (index === -1) {
      return cover;
    }
    return cover.slice(0, index) + "t6" + cover.slice(index + 1);
  });
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <!-- 标签页切换 -->
      <div class="tabs tabs-border">
        <a
          class="tab"
          :class="{ 'tab-active text-primary': activeTab === 'synced' }"
          @click="switchTab('synced')"
        >
          已同步书籍
        </a>
        <a
          class="tab"
          :class="{ 'tab-active text-primary': activeTab === 'bookshelf' }"
          @click="switchTab('bookshelf')"
        >
          我的书架
        </a>
      </div>

      <!-- 已同步书籍标签页 -->
      <div v-if="activeTab === 'synced'">
        <div class="flex justify-between mb-2">
          <h2 class="card-title">已同步书籍</h2>
          <button class="btn btn-sm btn-circle" @click="loadSyncedBooks">
            <Icon icon="mdi:refresh" class="text-lg" />
          </button>
        </div>

        <div v-if="isSyncedLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div
          v-else-if="syncedErrorMessage"
          class="alert alert-error alert-soft"
        >
          <Icon icon="mdi:alert-circle" class="text-lg" />
          <span>{{ syncedErrorMessage }}</span>
        </div>

        <div
          v-else-if="syncedBooks.length === 0"
          class="alert alert-info alert-soft"
        >
          <Icon icon="mdi:information" class="text-lg" />
          <span>暂无已同步的书籍数据</span>
        </div>

        <div v-else>
          <div
            v-for="book in paginatedSyncedBooks"
            :key="book.bookId"
            class="card card-side bg-base-200 shadow-md mb-4 border border-neutral/10"
          >
            <figure class="w-24 min-w-24 h-32 m-2">
              <img
                :src="bookCover(book.cover)"
                :alt="book.title"
                class="h-full w-full rounded-md"
              />
            </figure>
            <div class="card-body p-2">
              <h3 class="card-title text-base">
                <a
                  :href="wereadService.getUrl(book.bookId)"
                  target="_blank"
                  class="hover:underline hover:text-primary transition-colors duration-200"
                >
                  {{ book.title }}
                </a>
              </h3>
              <p class="text-sm opacity-70">作者: {{ book.author }}</p>
              <div class="flex gap-4">
                <div class="badge badge-primary badge-xs flex">
                  <Icon icon="mdi:note-text" />
                  笔记: {{ book.notesCount }}
                </div>
                <div class="badge badge-warning text-white badge-xs flex">
                  <Icon icon="mdi:bookmark" />
                  划线: {{ book.bookmarksCount }}
                </div>
              </div>
              <div class="text-xs opacity-50" v-if="book.lastSyncTime">
                最后同步: {{ book.lastSyncTime }}
              </div>
            </div>
          </div>

          <!-- 分页控件 -->
          <div class="flex justify-center mt-4" v-if="syncedTotalPages > 1">
            <div class="join">
              <button
                class="join-item btn btn-sm"
                :class="{ 'btn-disabled': syncedCurrentPage === 1 }"
                @click="goToSyncedPage(syncedCurrentPage - 1)"
              >
                <Icon icon="mdi:chevron-left" />
              </button>
              <button class="join-item btn btn-sm">
                {{ syncedCurrentPage }} / {{ syncedTotalPages }}
              </button>
              <button
                class="join-item btn btn-sm"
                :class="{
                  'btn-disabled': syncedCurrentPage === syncedTotalPages,
                }"
                @click="goToSyncedPage(syncedCurrentPage + 1)"
              >
                <Icon icon="mdi:chevron-right" />
              </button>
            </div>
          </div>

          <!-- 书籍总数信息 -->
          <div class="text-center text-sm text-gray-500 mt-2">
            共 {{ syncedBooks.length }} 本已同步书籍
          </div>
        </div>
      </div>

      <!-- 我的书架标签页 -->
      <div v-if="activeTab === 'bookshelf'">
        <div class="flex justify-between mb-2">
          <h2 class="card-title">我的书架</h2>
          <button class="btn btn-sm btn-circle" @click="loadBookshelf">
            <Icon icon="mdi:refresh" class="text-lg" />
          </button>
        </div>

        <!-- 同步结果提示 -->
        <div
          v-if="syncResult"
          class="alert mb-4"
          :class="syncResult.success ? 'alert-success' : 'alert-error'"
        >
          <Icon
            :icon="syncResult.success ? 'mdi:check-circle' : 'mdi:alert-circle'"
            class="text-lg"
          />
          <span>{{ syncResult.message }}</span>
          <button class="btn btn-sm btn-ghost" @click="syncResult = null">
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div v-if="isBookshelfLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div
          v-else-if="bookshelfErrorMessage"
          class="alert alert-error alert-soft"
        >
          <Icon icon="mdi:alert-circle" class="text-lg" />
          <span>{{ bookshelfErrorMessage }}</span>
        </div>

        <div
          v-else-if="bookshelfBooks.length === 0"
          class="alert alert-info alert-soft"
        >
          <Icon icon="mdi:information" class="text-lg" />
          <span>暂无书架数据</span>
        </div>

        <div v-else>
          <div
            v-for="book in paginatedBookshelfBooks"
            :key="book.bookId"
            class="card card-side bg-base-200 shadow-md mb-4 border border-neutral/10"
          >
            <figure class="w-24 min-w-24 h-32 m-2">
              <img
                :src="bookCover(book.cover)"
                :alt="book.title"
                class="h-full w-full rounded-md"
              />
            </figure>
            <div class="card-body p-2">
              <h3 class="card-title text-base">
                <a
                  :href="wereadService.getUrl(book.bookId)"
                  target="_blank"
                  class="hover:underline hover:text-primary transition-colors duration-200"
                >
                  {{ book.title }}
                </a>
              </h3>
              <p class="text-sm opacity-70">作者: {{ book.author }}</p>
              <!-- 笔记和划线数量 -->
              <div
                class="flex gap-2"
                v-if="
                  book.isSynced &&
                  (book.notesCount !== undefined ||
                    book.bookmarksCount !== undefined)
                "
              >
                <div
                  class="badge badge-primary badge-xs flex"
                  v-if="book.notesCount !== undefined"
                >
                  <Icon icon="mdi:note-text" />
                  笔记: {{ book.notesCount }}
                </div>
                <div
                  class="badge badge-warning text-white badge-xs flex"
                  v-if="book.bookmarksCount !== undefined"
                >
                  <Icon icon="mdi:bookmark" />
                  划线: {{ book.bookmarksCount }}
                </div>
              </div>
              <!-- 同步状态和同步按钮 -->
              <div class="flex justify-between items-center w-full">
                <div
                  v-if="book.isSynced"
                  class="badge badge-success badge-sm text-white flex gap-1"
                >
                  <Icon icon="mdi:check-circle" />
                  已同步
                </div>
                <button
                  class="btn btn-primary btn-xs"
                  @click="syncBook(book.bookId)"
                  :disabled="syncingBookId === book.bookId"
                >
                  <span
                    v-if="syncingBookId === book.bookId"
                    class="loading loading-spinner loading-xs"
                  ></span>
                  {{
                    syncingBookId === book.bookId
                      ? "同步中..."
                      : book.isSynced
                      ? "重新同步"
                      : "同步"
                  }}
                </button>
              </div>
            </div>

            <!-- 分页控件 -->
            <div
              class="flex justify-center mt-4"
              v-if="bookshelfTotalPages > 1"
            >
              <div class="join">
                <button
                  class="join-item btn btn-sm"
                  :class="{ 'btn-disabled': bookshelfCurrentPage === 1 }"
                  @click="goToBookshelfPage(bookshelfCurrentPage - 1)"
                >
                  <Icon icon="mdi:chevron-left" />
                </button>
                <button class="join-item btn btn-sm">
                  {{ bookshelfCurrentPage }} / {{ bookshelfTotalPages }}
                </button>
                <button
                  class="join-item btn btn-sm"
                  :class="{
                    'btn-disabled':
                      bookshelfCurrentPage === bookshelfTotalPages,
                  }"
                  @click="goToBookshelfPage(bookshelfCurrentPage + 1)"
                >
                  <Icon icon="mdi:chevron-right" />
                </button>
              </div>
            </div>
          </div>
          <!-- 书籍总数信息 -->
          <div class="text-center text-sm text-gray-500 mt-2">
            共 {{ bookshelfBooks.length }} 本书籍
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
