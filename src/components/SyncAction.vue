<script setup lang="ts">
  import { ref } from "vue";
  import { Icon } from "@iconify/vue";
  import { syncService } from "../services/sync";
  import { storageService } from "../services/storage";

  const isSyncing = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const lastSyncTime = ref<string | null>(null);

  // 执行同步
  const sync = async () => {
    isSyncing.value = true;
    errorMessage.value = "";
    successMessage.value = "";

    try {
      // 检查设置是否完整
      const writeathonSettings = await storageService.getWriteathonSettings();
      const wereadCookie = await storageService.getWeReadCookie();

      if (!writeathonSettings.apiToken || !writeathonSettings.userId) {
        errorMessage.value = "请先设置Writeathon API Token和用户ID";
        return;
      }

      if (!wereadCookie) {
        errorMessage.value = "请先登录微信读书";
        return;
      }

      // 执行同步
      const result = await syncService.sync();

      if (result.success) {
        successMessage.value = result.message;
        lastSyncTime.value = new Date().toLocaleString();
      } else {
        errorMessage.value = result.message;
      }
    } catch (error) {
      console.error("同步失败:", error);
      errorMessage.value = `同步失败: ${error.message || "未知错误"}`;
    } finally {
      isSyncing.value = false;
    }
  };

  // 加载上次同步时间
  const loadLastSyncTime = async () => {
    try {
      const histories = await storageService.getSyncHistory();
      if (histories.length > 0 && histories[0].success) {
        lastSyncTime.value = new Date(histories[0].timestamp).toLocaleString();
      }
    } catch (error) {
      console.error("加载上次同步时间失败:", error);
    }
  };

  // 初始化
  loadLastSyncTime();
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-primary">
        <Icon icon="mdi:sync" class="mr-2" />
        同步操作
      </h2>

      <div class="mt-4">
        <div v-if="errorMessage" class="alert alert-error mb-4">
          <Icon icon="mdi:alert-circle" class="mr-1" />
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="alert alert-success mb-4">
          <Icon icon="mdi:check-circle" class="mr-1" />
          {{ successMessage }}
        </div>

        <div
          v-if="lastSyncTime"
          class="mb-4 text-sm opacity-70 flex items-center underline decoration-dashed underline-offset-4"
        >
          <Icon icon="mdi:clock-outline" class="mr-1" />
          上次同步时间: {{ lastSyncTime }}
        </div>

        <button
          @click="sync"
          class="btn btn-primary w-full"
          :disabled="isSyncing"
        >
          <span
            v-if="isSyncing"
            class="loading loading-spinner loading-xs mr-2"
          ></span>
          <Icon v-else icon="mdi:sync" class="mr-1" />
          {{ isSyncing ? "同步中..." : "开始同步" }}
        </button>
      </div>
    </div>
  </div>
</template>
