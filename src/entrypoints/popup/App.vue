<script lang="ts" setup>
  import { ref } from "vue";
  import { Icon } from "@iconify/vue";
  import WeReadLogin from "@/components/WeReadLogin.vue";
  import WriteathonSettings from "@/components/WriteathonSettings.vue";
  import SyncSettings from "@/components/SyncSettings.vue";
  import SyncAction from "@/components/SyncAction.vue";
  import SyncHistory from "@/components/SyncHistory.vue";
  import SyncedBooks from "@/components/SyncedBooks.vue";
  import UserGuide from "@/components/UserGuide.vue";
  import logo from "~/assets/icon.png";

  // 标签页
  const tabs = [
    { id: "sync", label: "同步", icon: "mdi:sync" },
    { id: "books", label: "书籍", icon: "mdi:book" },
    { id: "settings", label: "设置", icon: "mdi:cog" },
    { id: "history", label: "历史", icon: "mdi:history" },
    { id: "guide", label: "帮助", icon: "mdi:help-circle" },
  ];

  const activeTab = ref("sync");

  const setActiveTab = (tabId: string) => {
    activeTab.value = tabId;
  };
</script>

<template>
  <div class="container mx-auto p-4 w-[400px] min-h-[550px]">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold flex items-center gap-2">
        <div class="avatar">
          <div class="w-10 rounded-full p-2.5 bg-white shadow">
            <img :src="logo" />
          </div>
        </div>
        微信读书 → Writeathon 助手
      </h1>
    </header>

    <main>
      <!-- 同步标签页 -->
      <div v-if="activeTab === 'sync'">
        <div class="flex gap-4 flex-col">
          <WeReadLogin />
          <SyncAction />
        </div>
      </div>

      <!-- 设置标签页 -->
      <div v-if="activeTab === 'settings'">
        <div class="flex gap-4 flex-col">
          <WriteathonSettings />
          <SyncSettings />
        </div>
      </div>

      <!-- 书籍标签页 -->
      <div v-if="activeTab === 'books'">
        <SyncedBooks />
      </div>

      <!-- 历史标签页 -->
      <div v-if="activeTab === 'history'">
        <SyncHistory />
      </div>

      <!-- 帮助标签页 -->
      <div v-if="activeTab === 'guide'">
        <UserGuide />
      </div>
    </main>

    <footer class="mt-14 pt-4 border-t border-gray-200">
      <div class="dock dock-lg">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="setActiveTab(tab.id)"
          :class="{ 'dock-active text-primary': activeTab === tab.id }"
        >
          <Icon :icon="tab.icon" class="text-xl" />
          <span class="dock-label">{{ tab.label }}</span>
        </button>
      </div>
    </footer>
  </div>
</template>
