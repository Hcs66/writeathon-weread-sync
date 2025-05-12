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
  const activeTab = ref<"synced" | "bookshelf">("bookshelf");

  // 已同步书籍数据
  const syncedBooks = ref<SyncedBookData[]>([]);
  const isSyncedLoading = ref(true);
  const syncedErrorMessage = ref("");

  // 书架数据
  interface BookshelfBookData extends WeReadBook {
    isSynced: boolean;
    isAutoSync: boolean; // 新增
    notesCount?: number;
    bookmarksCount?: number;
    lastSyncTime?: string;
    isSelected?: boolean; // 新增：是否被选中
  }
  const bookshelfBooks = ref<BookshelfBookData[]>([]);
  const isBookshelfLoading = ref(true);
  const bookshelfErrorMessage = ref("");

  // 同步状态
  const syncingBookId = ref<string | null>(null);
  const syncResult = ref<{ success: boolean; message: string } | null>(null);

  // 多选相关
  const selectedBooks = ref<string[]>([]);
  const isAllSelected = ref(false);
  const isBatchSyncing = ref(false);

  // 分页相关 - 已同步书籍
  const syncedCurrentPage = ref(1);
  const pageSize = 10; // 每页显示10本书
  const syncedTotalPages = ref(0);

  // 分页相关 - 书架
  const bookshelfCurrentPage = ref(1);
  const bookshelfTotalPages = ref(0);

  // 搜索相关
  const syncedSearchQuery = ref("");
  const bookshelfSearchQuery = ref("");

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
      const allBooks = await wereadService.getBookshelf(wereadCookie.value);

      // 筛选已同步的书籍
      const synced: SyncedBookData[] = [];

      for (const book of allBooks) {
        if (syncedBookIds.includes(book.bookId)) {
          synced.push({
            ...book,
            notesCount: 0,
            bookmarksCount: 0,
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

      // 获取自动同步的书籍ID列表
      const autoSyncBookIds = await storageService.getAutoSyncBookIds();

      // 获取书架数据
      const books = await wereadService.getBookshelf(wereadCookie.value);

      // 为每本书添加同步状态
      const booksWithSyncStatus: BookshelfBookData[] = [];

      for (const book of books) {
        const isSynced = syncedBookIds.includes(book.bookId);
        const isAutoSync = autoSyncBookIds.includes(book.bookId);
        const lastSyncTime = await storageService.getBookLastSyncTime(
          book.bookId
        );
        const bookData: BookshelfBookData = {
          ...book,
          isSynced,
          isAutoSync,
          lastSyncTime: new Date(lastSyncTime).toISOString().split("T")[0], // 使用当前日期作为最后同步时间,
        };

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

  // 切换书籍自动同步状态
  const toggleAutoSync = async (book: BookshelfBookData) => {
    try {
      if (book.isAutoSync) {
        await storageService.removeAutoSyncBookId(book.bookId);
      } else {
        await storageService.saveAutoSyncBookId(book.bookId);
      }

      // 更新UI状态
      book.isAutoSync = !book.isAutoSync;
    } catch (error) {
      console.error("切换自动同步状态失败:", error);
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

  // 增量同步单本书籍
  const incrementalSyncBook = async (bookId: string) => {
    syncingBookId.value = bookId;
    syncResult.value = null;

    try {
      // 调用同步服务，传入增量同步范围
      const result = await syncService.syncSingleBook(bookId, true);
      syncResult.value = result;

      if (result.success) {
        // 同步成功后开启自动同步
        await toggleAutoSync({
          ...result.book!,
          isSynced: true,
          isAutoSync: false,
          notesCount: result.notesCount,
          bookmarksCount: result.bookmarksCount,
        });
        // 如果同步成功，重新加载已同步书籍数据
        if (result.notesCount > 0 || result.bookmarksCount > 0) {
          loadBookshelf();
        }
      }
    } catch (error: any) {
      console.error("增量同步书籍失败:", error);
      syncResult.value = {
        success: false,
        message: `增量同步失败: ${error.message || "未知错误"}`,
      };
    } finally {
      syncingBookId.value = null;
    }
  };

  // 批量同步选中的书籍
  const batchSyncSelectedBooks = async () => {
    if (selectedBooks.value.length === 0) {
      syncResult.value = {
        success: false,
        message: "请先选择要同步的书籍",
      };
      return;
    }

    isBatchSyncing.value = true;
    syncResult.value = null;

    try {
      let successCount = 0;
      let failCount = 0;

      for (const bookId of selectedBooks.value) {
        try {
          // 调用同步服务，传入增量同步范围
          const result = await syncService.syncSingleBook(bookId, true);

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`同步书籍 ${bookId} 失败:`, error);
          failCount++;
        }
      }

      // 更新同步结果
      syncResult.value = {
        success: successCount > 0,
        message: `批量同步完成：成功 ${successCount} 本，失败 ${failCount} 本`,
      };

      // 重新加载书架数据
      await loadBookshelf();

      // 清空选中状态
      selectedBooks.value = [];
      isAllSelected.value = false;
    } catch (error: any) {
      console.error("批量同步书籍失败:", error);
      syncResult.value = {
        success: false,
        message: `批量同步失败: ${error.message || "未知错误"}`,
      };
    } finally {
      isBatchSyncing.value = false;
    }
  };

  // 选择/取消选择单本书籍
  const toggleSelectBook = (bookId: string) => {
    const index = selectedBooks.value.indexOf(bookId);
    if (index === -1) {
      selectedBooks.value.push(bookId);
    } else {
      selectedBooks.value.splice(index, 1);
    }

    // 更新全选状态
    isAllSelected.value =
      filteredBookshelfBooks.value.length > 0 &&
      selectedBooks.value.length === filteredBookshelfBooks.value.length;
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (isAllSelected.value) {
      // 取消全选
      selectedBooks.value = [];
    } else {
      // 全选当前页的书籍
      selectedBooks.value = paginatedBookshelfBooks.value.map(
        (book) => book.bookId
      );
    }
    isAllSelected.value = !isAllSelected.value;
  };

  // 获取当前页的已同步书籍（添加搜索过滤）
  const filteredSyncedBooks = computed(() => {
    if (!syncedSearchQuery.value) return syncedBooks.value;

    const query = syncedSearchQuery.value.toLowerCase();
    return syncedBooks.value.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
    );
  });

  const paginatedSyncedBooks = computed(() => {
    const start = (syncedCurrentPage.value - 1) * pageSize;
    const end = start + pageSize;
    return filteredSyncedBooks.value.slice(start, end);
  });

  // 获取当前页的书架书籍（添加搜索过滤）
  const filteredBookshelfBooks = computed(() => {
    if (!bookshelfSearchQuery.value) return bookshelfBooks.value;

    const query = bookshelfSearchQuery.value.toLowerCase();
    return bookshelfBooks.value.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
    );
  });

  const paginatedBookshelfBooks = computed(() => {
    const start = (bookshelfCurrentPage.value - 1) * pageSize;
    const end = start + pageSize;
    return filteredBookshelfBooks.value.slice(start, end);
  });

  // 更新分页计算逻辑
  // const syncedTotalPages = computed(() =>
  //   Math.ceil(filteredSyncedBooks.value.length / pageSize)
  // );

  // const bookshelfTotalPages = computed(() =>
  //   Math.ceil(filteredBookshelfBooks.value.length / pageSize)
  // );

  // 重置搜索和分页
  const resetSyncedSearch = () => {
    syncedSearchQuery.value = "";
    syncedCurrentPage.value = 1;
  };

  const resetBookshelfSearch = () => {
    bookshelfSearchQuery.value = "";
    bookshelfCurrentPage.value = 1;
  };

  // 切换标签页时重置搜索
  const switchTab = (tab: "synced" | "bookshelf") => {
    activeTab.value = tab;

    // 如果切换到书架标签页且数据为空，则加载书架数据
    if (tab === "bookshelf" && bookshelfBooks.value.length === 0) {
      loadBookshelf();
    }
  };

  // 组件挂载时加载已同步书籍数据
  onMounted(loadBookshelf);

  // 计算属性：转换封面图片URL
  const bookCover = computed(() => (cover: string) => {
    if (!cover) return "";
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
      <!-- <div class="tabs tabs-border">
        <a
          class="tab"
          :class="{ 'tab-active text-primary': activeTab === 'bookshelf' }"
          @click="switchTab('bookshelf')"
        >
          我的书架
        </a>
        <a
          class="tab"
          :class="{ 'tab-active text-primary': activeTab === 'synced' }"
          @click="switchTab('synced')"
        >
          已同步书籍
        </a>
      </div> -->

      <!-- 已同步书籍标签页 -->
      <div v-if="activeTab === 'synced'">
        <div class="flex justify-between mb-2">
          <h2 class="card-title">已同步书籍</h2>
          <button class="btn btn-sm btn-circle" @click="loadSyncedBooks">
            <Icon icon="mdi:refresh" class="text-lg" />
          </button>
        </div>

        <!-- 搜索框 -->
        <div class="form-control mb-4 mt-4">
          <label class="input">
            <input
              type="text"
              placeholder="搜索书籍标题或作者..."
              v-model="syncedSearchQuery"
              @input="syncedCurrentPage = 1"
            />
            <button
              class="btn btn-sm btn-ghost btn-circle"
              @click="resetSyncedSearch"
              v-if="syncedSearchQuery"
            >
              <Icon icon="mdi:close" class="text-lg" />
            </button>
          </label>
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

        <div
          v-else-if="filteredSyncedBooks.length === 0"
          class="alert alert-info alert-soft"
        >
          <Icon icon="mdi:information" class="text-lg" />
          <span>没有找到匹配的书籍</span>
        </div>

        <div v-else>
          <div
            v-for="book in paginatedSyncedBooks"
            :key="book.bookId"
            class="card card-side bg-base-200 shadow-md mb-4 border border-neutral/10"
          >
            <div class="flex items-center ml-2">
              <input
                type="checkbox"
                class="checkbox"
                :checked="selectedBooks.includes(book.bookId)"
                @change="toggleSelectBook(book.bookId)"
                :disabled="syncingBookId === book.bookId || isBatchSyncing"
              />
            </div>
            <figure
              class="w-24 min-w-24 h-32 m-2 border border-neutral/10 rounded-md"
            >
              <img
                :src="bookCover(book.cover)"
                :alt="book.title"
                class="h-full w-full"
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
              <div class="text-xs opacity-50" v-if="book.lastSyncTime">
                上次同步时间: {{ book.lastSyncTime }}
              </div>
            </div>
          </div>

          <!-- 分页控件 -->
          <div class="flex justify-center mt-4" v-if="syncedTotalPages > 1">
            <div class="join">
              <button
                class="join-item btn btn-sm"
                :class="{ 'btn-disabled': syncedCurrentPage === 1 }"
                @click="syncedCurrentPage--"
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
                @click="syncedCurrentPage++"
              >
                <Icon icon="mdi:chevron-right" />
              </button>
            </div>
          </div>

          <!-- 书籍总数信息 -->
          <div class="text-center text-sm text-gray-500 mt-2">
            共 {{ filteredSyncedBooks.length }} 本{{
              syncedSearchQuery ? "匹配的" : "已同步"
            }}书籍
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

        <!-- 搜索框和批量操作 -->
        <div class="flex flex-col md:flex-row gap-4 mb-4 mt-4">
          <div class="form-control flex-1 w-full">
            <label class="input w-full">
              <input
                type="text"
                placeholder="搜索书籍标题或作者..."
                v-model="bookshelfSearchQuery"
                @input="bookshelfCurrentPage = 1"
              />
              <button
                class="btn btn-sm btn-ghost btn-circle"
                @click="resetBookshelfSearch"
                v-if="bookshelfSearchQuery"
              >
                <Icon icon="mdi:close" class="text-lg" />
              </button>
            </label>
          </div>

          <!-- 批量操作按钮 -->
          <div class="flex gap-2 justify-between items-center">
            <div class="form-control">
              <label class="label cursor-pointer gap-2 ml-2">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  :disabled="
                    filteredBookshelfBooks.length === 0 || isBatchSyncing
                  "
                />
                <span class="label-text">全选</span>
              </label>
            </div>
            <button
              class="btn btn-primary btn-sm"
              @click="batchSyncSelectedBooks"
              :disabled="selectedBooks.length === 0 || isBatchSyncing"
            >
              <span
                v-if="isBatchSyncing"
                class="loading loading-spinner loading-xs"
              ></span>
              {{ isBatchSyncing ? "同步中..." : "同步选中" }} ({{
                selectedBooks.length
              }})
            </button>
          </div>
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

        <div
          v-else-if="filteredBookshelfBooks.length === 0"
          class="alert alert-info alert-soft"
        >
          <Icon icon="mdi:information" class="text-lg" />
          <span>没有找到匹配的书籍</span>
        </div>

        <div v-else>
          <div
            v-for="book in paginatedBookshelfBooks"
            :key="book.bookId"
            class="card card-side bg-base-200 shadow-md mb-4 border border-neutral/10 relative"
          >
            <div class="flex items-center ml-2">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                :checked="selectedBooks.includes(book.bookId)"
                @change="toggleSelectBook(book.bookId)"
                :disabled="syncingBookId === book.bookId || isBatchSyncing"
              />
            </div>
            <figure
              class="w-24 min-w-24 h-32 m-2 border border-neutral/10 rounded-md"
            >
              <img
                :src="bookCover(book.cover)"
                :alt="book.title"
                class="h-full w-full"
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

              <!-- 同步按钮和同步开关 -->
              <div class="flex justify-between items-center w-full">
                <div class="flex gap-2">
                  <button
                    class="btn btn-primary btn-xs"
                    @click="incrementalSyncBook(book.bookId)"
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
              <div
                class="text-xs opacity-50"
                v-if="book.isSynced && book.lastSyncTime"
              >
                最后同步: {{ book.lastSyncTime }}
              </div>
            </div>
          </div>
          <!-- 分页控件 -->
          <div class="flex justify-center mt-4" v-if="bookshelfTotalPages > 1">
            <div class="join">
              <button
                class="join-item btn btn-sm"
                :class="{ 'btn-disabled': bookshelfCurrentPage === 1 }"
                @click="bookshelfCurrentPage--"
              >
                <Icon icon="mdi:chevron-left" />
              </button>
              <button class="join-item btn btn-sm">
                {{ bookshelfCurrentPage }} / {{ bookshelfTotalPages }}
              </button>
              <button
                class="join-item btn btn-sm"
                :class="{
                  'btn-disabled': bookshelfCurrentPage === bookshelfTotalPages,
                }"
                @click="bookshelfCurrentPage++"
              >
                <Icon icon="mdi:chevron-right" />
              </button>
            </div>
          </div>
          <!-- 书籍总数信息 -->
          <div class="text-center text-sm text-gray-500 mt-2">
            共 {{ filteredBookshelfBooks.length }} 本{{
              bookshelfSearchQuery ? "匹配的" : ""
            }}书籍
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
