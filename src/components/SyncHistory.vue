<script setup lang="ts">
  import { ref, onMounted, computed } from "vue";
  import { Icon } from "@iconify/vue";
  import { storageService } from "../services/storage";
  import { SyncHistory } from "../types";

  const histories = ref<SyncHistory[]>([]);
  const isLoading = ref(false);
  const isClearing = ref(false);
  const isDeleting = ref(false);
  const isExporting = ref(false);
  const isImporting = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const fileInputRef = ref<HTMLInputElement | null>(null);

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

  // 删除单条同步历史
  const deleteHistoryItem = async (historyId: string) => {
    if (!confirm("确定要删除这条同步记录吗？")) return;

    isDeleting.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    try {
      await storageService.deleteSyncHistoryItem(historyId);
      await loadHistory(); // 重新加载历史记录

      // 处理分页：如果当前页没有数据了，则回到上一页
      if (paginatedHistories.value.length === 0 && currentPage.value > 1) {
        currentPage.value--;
      }

      successMessage.value = "记录已删除";
    } catch (error) {
      console.error("删除同步记录失败:", error);
      errorMessage.value = "删除同步记录失败";
    } finally {
      isDeleting.value = false;
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

  // 导出所有数据
  const exportData = async () => {
    isExporting.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    try {
      // 获取所有存储数据
      const data = await storageService.exportAllData();

      // 创建下载链接
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // 创建下载链接并触发下载
      const a = document.createElement("a");
      a.href = url;
      a.download = `writeathon-weread-sync-data-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      successMessage.value = "数据导出成功";
    } catch (error) {
      console.error("导出数据失败:", error);
      errorMessage.value = "导出数据失败";
    } finally {
      isExporting.value = false;
    }
  };

  // 触发文件选择对话框
  const triggerImportFile = () => {
    if (fileInputRef.value) {
      fileInputRef.value.click();
    }
  };

  // 处理文件导入
  const handleFileImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      errorMessage.value = "请选择JSON格式的文件";
      return;
    }

    isImporting.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    try {
      // 读取文件内容
      const fileContent = await readFileAsText(file);
      const importData = JSON.parse(fileContent);

      // 确认导入
      if (
        !confirm("确定要导入数据吗？这将合并现有数据，相同ID的记录将被去重。")
      ) {
        isImporting.value = false;
        return;
      }

      // 导入数据
      await storageService.importData(importData);

      // 重新加载历史记录
      await loadHistory();

      successMessage.value = "数据导入成功";
    } catch (error) {
      console.error("导入数据失败:", error);
      errorMessage.value =
        "导入数据失败: " +
        (error instanceof Error ? error.message : String(error));
    } finally {
      isImporting.value = false;
      // 重置文件输入框
      if (fileInputRef.value) {
        fileInputRef.value.value = "";
      }
    }
  };

  // 读取文件内容为文本
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file);
    });
  };

  onMounted(loadHistory);
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex flex-col gap-2">
        <h2 class="card-title text-primary">
          <Icon icon="mdi:history" class="mr-2" />
          同步历史
        </h2>

        <div class="flex gap-2">
          <!-- 导入按钮 -->
          <button
            @click="triggerImportFile"
            class="btn btn-primary btn-sm btn-outline"
            :disabled="isImporting"
          >
            <Icon icon="mdi:file-import" class="mr-1" />
            导入数据
          </button>

          <!-- 导出按钮 -->
          <button
            @click="exportData"
            class="btn btn-info btn-sm btn-outline"
            :disabled="isExporting"
          >
            <Icon icon="mdi:file-export" class="mr-1" />
            导出数据
          </button>

          <!-- 清除历史按钮 -->
          <button
            v-if="histories.length > 0"
            @click="clearHistory"
            class="btn btn-error btn-sm btn-outline"
            :disabled="isClearing"
          >
            <Icon icon="mdi:delete" class="mr-1" />
            清除历史
          </button>

          <!-- 隐藏的文件输入框 -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleFileImport"
          />
        </div>
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
              <div class="flex items-center gap-2">
                <span
                  class="badge badge-soft"
                  :class="history.success ? 'badge-success' : 'badge-error'"
                >
                  {{ history.success ? "成功" : "失败" }}
                </span>
                <button
                  @click.stop="deleteHistoryItem(history.id)"
                  class="btn btn-ghost btn-xs btn-circle"
                  :disabled="isDeleting"
                  title="删除此记录"
                >
                  <Icon icon="mdi:delete-outline" class="text-error" />
                </button>
              </div>
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
            <span v-if="totalPages > 1">，当前显示第 {{ currentPage }} 页</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
