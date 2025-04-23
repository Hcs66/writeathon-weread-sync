<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { Icon } from "@iconify/vue";
  import { storageService } from "../services/storage";
  import { wereadService } from "../services/weread";
  import { browser } from "#imports";

  const isLoggedIn = ref(false);
  const isLoading = ref(false);
  const errorMessage = ref("");
  const userInfo = ref<any>(null);

  // 检查登录状态
  const checkLoginStatus = async () => {
    isLoading.value = true;
    errorMessage.value = "";

    try {
      const cookie = await storageService.getWeReadCookie();
      if (!cookie) {
        isLoggedIn.value = false;
        return;
      }
      isLoggedIn.value = true;
    } catch (error) {
      console.error("检查登录状态失败:", error);
      errorMessage.value = "检查登录状态失败";
      isLoggedIn.value = false;
    } finally {
      isLoading.value = false;
    }
  };

  // 获取微信读书Cookie
  const getWeReadCookie = async () => {
    isLoading.value = true;
    errorMessage.value = "";

    try {
      // 获取微信读书域名下的所有Cookie
      const cookies = await browser.cookies.getAll({ domain: "weread.qq.com" });

      if (!cookies || cookies.length === 0) {
        errorMessage.value = "未找到微信读书Cookie，请先登录微信读书网页版";
        return;
      }

      // 构建Cookie字符串
      const cookieStr = cookies
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join("; ");

      // 验证Cookie是否有效
      const info = await wereadService.getUserInfo(cookieStr);
      if (!info) {
        errorMessage.value = "微信读书Cookie无效，请重新登录微信读书网页版";
        return;
      }

      // 保存Cookie
      await storageService.saveWeReadCookie(cookieStr);
      userInfo.value = info;
      isLoggedIn.value = true;
    } catch (error) {
      console.error("获取微信读书Cookie失败:", error);
      errorMessage.value = "获取微信读书Cookie失败";
    } finally {
      isLoading.value = false;
    }
  };

  // 退出登录
  const logout = async () => {
    isLoading.value = true;

    try {
      await storageService.clearWeReadCookie();
      isLoggedIn.value = false;
      userInfo.value = null;
    } catch (error) {
      console.error("退出登录失败:", error);
      errorMessage.value = "退出登录失败";
    } finally {
      isLoading.value = false;
    }
  };

  // 打开微信读书网页版
  const openWeRead = () => {
    browser.tabs.create({ url: "https://weread.qq.com/" });
  };

  onMounted(checkLoginStatus);
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-primary">
        <Icon icon="mdi:book-open-page-variant" class="mr-2" />
        微信读书登录
      </h2>

      <div v-if="isLoading" class="flex justify-center my-4">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div v-else-if="isLoggedIn" class="mt-4">
        <div class="alert alert-success alert-soft mb-4">
          <Icon icon="mdi:check-circle" class="mr-2" />
          <span>已成功登录微信读书</span>
        </div>

        <button @click="logout" class="btn btn-error text-white w-full">
          <Icon icon="mdi:logout" class="mr-1" />
          退出登录
        </button>
      </div>

      <div v-else class="mt-4">
        <div v-if="errorMessage" class="alert alert-error alert-soft mb-4">
          <Icon icon="mdi:alert-circle" class="mr-1" />
          {{ errorMessage }}
        </div>

        <div class="flex flex-col gap-3">
          <button @click="openWeRead" class="btn btn-primary w-full">
            <Icon icon="mdi:open-in-new" class="mr-1" />
            打开微信读书网页版
          </button>

          <button
            @click="getWeReadCookie"
            class="btn btn-primary btn-outline w-full"
          >
            <Icon icon="mdi:cookie" class="mr-1" />
            获取微信读书Cookie
          </button>
        </div>

        <div class="mt-4 text-xs opacity-70">
          <p>说明:</p>
          <ol class="list-decimal pl-5 mt-1">
            <li>点击"打开微信读书网页版"按钮</li>
            <li>在打开的页面中登录微信读书</li>
            <li>登录成功后打开插件页面</li>
            <li>点击"获取微信读书Cookie"按钮</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>
