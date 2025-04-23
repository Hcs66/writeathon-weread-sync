<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { Icon } from "@iconify/vue";
  import { storageService } from "../services/storage";
  import { SyncSettings } from "../types";

  const settings = ref<SyncSettings>({
    syncRange: "all",
    syncInterval: 15,
    mergeNotes: false,
    autoSync: false,
    requestDelay: 100,
  });

  const isLoading = ref(false);
  const isSaving = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");

  // 同步范围选项
  const syncRangeOptions = [
    { value: "last1days", label: "最近1天" },
    { value: "last7days", label: "最近7天" },
    { value: "last14days", label: "最近14天" },
    { value: "last30days", label: "最近30天" },
    { value: "all", label: "全部" },
  ];

  // 同步间隔选项
  const syncIntervalOptions = [
    { value: 15, label: "15分钟" },
    { value: 30, label: "30分钟" },
    { value: 60, label: "1小时" },
  ];

  // 请求延迟选项
  const requestDelayOptions = [
    { value: 500, label: "0.5秒" },
    { value: 1000, label: "1秒" },
    { value: 2000, label: "2秒" },
    { value: 3000, label: "3秒" },
    { value: 5000, label: "5秒" },
  ];

  // 加载设置
  const loadSettings = async () => {
    isLoading.value = true;

    try {
      const savedSettings = await storageService.getSyncSettings();
      settings.value = savedSettings;
    } catch (error) {
      console.error("加载同步设置失败:", error);
      errorMessage.value = "加载设置失败";
    } finally {
      isLoading.value = false;
    }
  };

  // 保存设置
  const saveSettings = async () => {
    errorMessage.value = "";
    successMessage.value = "";
    isSaving.value = true;

    try {
      await storageService.saveSyncSettings(settings.value);
      successMessage.value = "设置已保存";
    } catch (error) {
      console.error("保存同步设置失败:", error);
      errorMessage.value = "保存设置失败";
    } finally {
      isSaving.value = false;
    }
  };

  onMounted(loadSettings);
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-primary">
        <Icon icon="mdi:sync" class="mr-2" />
        同步设置
      </h2>

      <div v-if="isLoading" class="flex justify-center my-4">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div v-else class="mt-4">
        <div v-if="errorMessage" class="alert alert-error alert-soft mb-4">
          <Icon icon="mdi:alert-circle" class="mr-1" />
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="alert alert-success alert-soft mb-4">
          <Icon icon="mdi:check-circle" class="mr-1" />
          {{ successMessage }}
        </div>

        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text font-bold">同步范围</span>
          </label>
          <select
            v-model="settings.syncRange"
            class="select select-bordered w-full"
          >
            <option
              v-for="option in syncRangeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- <div class="form-control mb-4">
          <label class="label">
            <span class="label-text font-bold">自动同步间隔</span>
          </label>
          <select
            v-model="settings.syncInterval"
            class="select select-bordered w-full"
          >
            <option
              v-for="option in syncIntervalOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div> -->

        <div class="form-control mb-4">
          <label class="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              v-model="settings.mergeNotes"
              class="checkbox checkbox-primary"
            />
            <span class="label-text font-bold">合并同一本书的笔记和划线</span>
          </label>
        </div>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              v-model="settings.autoSync"
              class="checkbox checkbox-primary"
            />
            <span class="label-text font-bold">启用自动同步</span>
          </label>
        </div>
        <div class="mb-4 text-gray-400">
          * 启用后每{{ settings.syncInterval }}分钟同步一次
        </div>
        <!-- <div class="form-control mb-4">
          <label class="label">
            <span class="label-text font-bold">请求延迟时间</span>
            <span class="label-text-alt text-xs text-gray-500"
              >避免短时间内发送大量请求</span
            >
          </label>
          <select
            v-model="settings.requestDelay"
            class="select select-bordered w-full"
          >
            <option
              v-for="option in requestDelayOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div> -->

        <button
          @click="saveSettings"
          class="btn btn-primary w-full"
          :disabled="isSaving"
        >
          <span
            v-if="isSaving"
            class="loading loading-spinner loading-xs"
          ></span>
          <Icon v-else icon="mdi:content-save" class="mr-1" />
          保存设置
        </button>
      </div>
    </div>
  </div>
</template>
