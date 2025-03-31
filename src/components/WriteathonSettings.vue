<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { Icon } from "@iconify/vue";
  import { storageService } from "../services/storage";
  import { writeathonService } from "../services/writeathon";
  import { WriteathonSettings } from "../types";

  const settings = ref<WriteathonSettings>({
    apiToken: "",
    userId: "",
    username: "",
  });

  const isLoading = ref(false);
  const isSaving = ref(false);
  const isValidating = ref(false);
  const errorMessage = ref("");
  const successMessage = ref("");
  const isValid = ref<boolean | null>(null);

  // 加载设置
  const loadSettings = async () => {
    isLoading.value = true;

    try {
      const savedSettings = await storageService.getWriteathonSettings();
      settings.value = savedSettings;

      // 如果有设置，验证凭证
      if (savedSettings.apiToken && savedSettings.userId) {
        await validateCredentials();
      }
    } catch (error) {
      console.error("加载Writeathon设置失败:", error);
      errorMessage.value = "加载设置失败";
    } finally {
      isLoading.value = false;
    }
  };

  // 保存设置
  const saveSettings = async () => {
    // 验证输入
    if (!settings.value.apiToken) {
      errorMessage.value = "请输入API Token";
      return;
    }

    if (!settings.value.userId) {
      errorMessage.value = "请输入用户ID";
      return;
    }

    errorMessage.value = "";
    successMessage.value = "";
    isSaving.value = true;

    try {
      await storageService.saveWriteathonSettings(settings.value);
      successMessage.value = "设置已保存";

      // 验证凭证
      await validateCredentials();
    } catch (error) {
      console.error("保存Writeathon设置失败:", error);
      errorMessage.value = "保存设置失败";
    } finally {
      isSaving.value = false;
    }
  };

  // 验证凭证
  const validateCredentials = async () => {
    if (!settings.value.apiToken || !settings.value.userId) {
      isValid.value = null;
      return;
    }

    isValidating.value = true;
    errorMessage.value = "";

    try {
      const valid = await writeathonService.validateCredentials(settings.value);
      isValid.value = valid;

      if (!valid) {
        errorMessage.value = "API Token或用户ID无效";
      } else {
        // 获取用户名
        const userInfo = await writeathonService.getUserInfo(settings.value);
        if (userInfo && userInfo.username) {
          settings.value.username = userInfo.username;
          await storageService.saveWriteathonSettings(settings.value);
        }
      }
    } catch (error) {
      console.error("验证Writeathon凭证失败:", error);
      errorMessage.value = "验证凭证失败";
      isValid.value = false;
    } finally {
      isValidating.value = false;
    }
  };

  // 打开Writeathon网站
  const openWriteathon = () => {
    browser.tabs.create({ url: "https://www.writeathon.cn/setting" });
  };

  onMounted(loadSettings);
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-primary">
        <Icon icon="mdi:cog" class="mr-2" />
        Writeathon设置
      </h2>

      <div v-if="isLoading" class="flex justify-center my-4">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div v-else class="mt-4">
        <div v-if="errorMessage" class="alert alert-error mb-4">
          <Icon icon="mdi:alert-circle" class="mr-1" />
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="alert alert-success mb-4">
          <Icon icon="mdi:check-circle" class="mr-1" />
          {{ successMessage }}
        </div>

        <div class="form-control mb-4">
          <label class="label" for="userId">
            <span class="label-text font-bold mb-2">用户ID</span>
          </label>
          <input
            id="userId"
            v-model="settings.userId"
            type="text"
            placeholder="请输入Writeathon用户ID"
            class="input input-bordered w-full"
          />
        </div>

        <div class="form-control mb-4">
          <label class="label" for="apiToken">
            <span class="label-text font-bold mb-2">API Token</span>
          </label>
          <input
            id="apiToken"
            v-model="settings.apiToken"
            type="text"
            placeholder="请输入Writeathon API Token"
            class="input input-bordered w-full"
          />
        </div>

        <div class="mb-4" v-if="isValid !== null">
          <div
            class="alert alert-soft"
            :class="isValid ? 'alert-success' : 'alert-error'"
          >
            <Icon
              :icon="isValid ? 'mdi:check-circle' : 'mdi:alert-circle'"
              class="mr-1"
            />
            <span>
              {{
                isValid
                  ? settings.username
                    ? `已验证 - ${settings.username}`
                    : "API Token和用户ID有效"
                  : "API Token或用户ID无效"
              }}
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <button
            @click="saveSettings"
            class="btn btn-primary w-full"
            :disabled="isSaving || isValidating"
          >
            <span
              v-if="isSaving || isValidating"
              class="loading loading-spinner loading-xs"
            ></span>
            <Icon v-else icon="mdi:content-save" class="mr-1" />
            保存设置
          </button>

          <button
            @click="openWriteathon"
            class="btn btn-primary btn-outline w-full"
          >
            <Icon icon="mdi:open-in-new" class="mr-1" />
            打开Writeathon集成设置
          </button>
        </div>

        <div class="mt-4 text-sm text-gray-600">
          <p>使用说明:</p>
          <ol class="list-decimal pl-5 mt-1">
            <li>点击"打开Writeathon集成设置"按钮</li>
            <li>在Writeathon网站上登录并进入设置→集成页面</li>
            <li>复制API Token和用户ID</li>
            <li>粘贴到上面的输入框中</li>
            <li>点击"保存设置"按钮</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>
