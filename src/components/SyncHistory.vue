<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { Icon } from "@iconify/vue";
  import { storageService } from "../services/storage";
  import { SyncHistory } from "../types";

  const histories = ref<SyncHistory[]>([]);
  const isLoading = ref(false);
  const isClearing = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");

  // 分页相关
  const currentPage = ref(1);
  const pageSize = 10; // 每页显示10条记录

  // 加载同步历史
  const loadHistory = async () => {
    isLoading.value = true;

    try {
      const syncHistory = await storageService.getSyncHistory();
      histories.value = syncHistory;
    } catch (error) {
      console.error("加载同步历史失败:", error);
      errorMessage.value = "加载同步历史失败";
    } finally {
      isLoading.value = false;
    }
  };

  // 清除同步历史
  const clearHistory = async () => {
    if (!confirm("确定要清除所有同步历史记录吗？")) return;

    isClearing.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    try {
      // 清除同步历史
      await storageService.clearSyncHistory();
      // 清除已同步书籍ID
      await storageService.clearSyncedBookIds();
      // 重置最后同步时间
      await storageService.resetLastSyncTime();
      histories.value = [];
      successMessage.value = "同步历史已清除";
    } catch (error) {
      console.error("清除同步历史失败:", error);
      errorMessage.value = "清除同步历史失败";
    } finally {
      isClearing.value = false;
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // 计算总页数
  const totalPages = computed(() => {
    return Math.ceil(histories.value.length / pageSize);
  });

  // 当前页的历史记录
  const paginatedHistories = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    const end = start + pageSize;
    return histories.value.slice(start, end);
  });

  // 页码变化
  const changePage = (page: number) => {
    if (page < 1 || page > totalPages.value) return;
    currentPage.value = page;
  };

  onMounted(loadHistory);
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <h2 class="card-title text-primary">
          <Icon icon="mdi:history" class="mr-2" />
          同步历史
        </h2>

        <button
          v-if="histories.length > 0"
          @click="clearHistory"
          class="btn btn-error btn-sm btn-outline"
          :disabled="isClearing"
        >
          <Icon icon="mdi:delete" class="mr-1" />
          清除历史
        </button>
      </div>

      <div v-if="isLoading" class="flex justify-center my-4">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div v-else class="mt-4">
        <div
          v-if="errorMessage"
          class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center"
        >
          <Icon icon="mdi:alert-circle" class="mr-1" />
          {{ errorMessage }}
        </div>

        <div
          v-if="successMessage"
          class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex items-center"
        >
          <Icon icon="mdi:check-circle" class="mr-1" />
          {{ successMessage }}
        </div>

        <div
          v-if="histories.length === 0"
          class="text-center text-gray-500 my-8"
        >
          <Icon icon="mdi:information-outline" class="text-xl mb-2" />
          <p>暂无同步历史记录</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="history in paginatedHistories"
            :key="history.id"
            class="border-neutral/10 border rounded-lg p-3 hover:bg-gray-50"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-600">{{
                formatDate(history.timestamp)
              }}</span>
              <span
                class="badge badge-soft"
                :class="history.success ? 'badge-success' : 'badge-error'"
              >
                {{ history.success ? "成功" : "失败" }}
              </span>
            </div>

            <div class="text-sm">
              <div class="flex items-center">
                <Icon icon="mdi:note-text" class="mr-1 text-primary" />
                <span>笔记: {{ history.notesCount }}条</span>
              </div>

              <div class="flex items-center mt-1">
                <Icon icon="mdi:bookmark" class="mr-1 text-primary" />
                <span>划线: {{ history.bookmarksCount }}条</span>
              </div>
            </div>

            <div v-if="history.message" class="mt-2 text-sm text-gray-700">
              <Icon icon="mdi:message-text" class="mb-1" />
              {{ history.message }}
            </div>
          </div>

          <!-- 分页控制 -->
          <div
            v-if="totalPages > 1"
            class="flex justify-center items-center mt-4 gap-2"
          >
            <button
              @click="changePage(currentPage - 1)"
              :disabled="currentPage === 1"
              class="btn btn-sm btn-circle"
            >
              <Icon icon="mdi:chevron-left" />
            </button>

            <span class="text-sm">{{ currentPage }} / {{ totalPages }}</span>

            <button
              @click="changePage(currentPage + 1)"
              :disabled="currentPage === totalPages"
              class="btn btn-sm btn-circle"
            >
              <Icon icon="mdi:chevron-right" />
            </button>
          </div>

          <!-- 历史记录总数信息 -->
          <div class="text-center text-sm text-gray-500 mt-2">
            共 {{ histories.length }} 条同步历史记录
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
