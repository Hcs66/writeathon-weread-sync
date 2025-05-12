import { storageService } from "../services/storage";
import { syncService } from "../services/sync";

// 自动同步定时器ID
let autoSyncTimerId: any | null;

// 启动自动同步
const startAutoSync = async () => {
  // 获取同步设置
  const syncSettings = await storageService.getSyncSettings();

  // 如果未启用自动同步，则不执行
  if (!syncSettings.autoSync) {
    stopAutoSync();
    return;
  }

  // 清除之前的定时器
  stopAutoSync();

  // 设置新的定时器，间隔时间为设置的分钟数转换为毫秒
  const intervalMs = syncSettings.syncInterval * 60 * 1000;
  autoSyncTimerId = setInterval(async () => {
    try {
      // 检查设置是否完整
      const writeathonSettings = await storageService.getWriteathonSettings();
      const wereadCookie = await storageService.getWeReadCookie();

      if (
        !writeathonSettings.apiToken ||
        !writeathonSettings.userId ||
        !wereadCookie
      ) {
        console.log("自动同步失败：设置不完整");
        return;
      }

      // 执行同步
      const result = await syncService.sync(true);
      console.log("自动同步结果:", result);
    } catch (error) {
      console.error("自动同步失败:", error);
    }
  }, intervalMs);

  console.log(`自动同步已启动，间隔时间: ${syncSettings.syncInterval} 分钟`);
};

// 停止自动同步
const stopAutoSync = () => {
  if (autoSyncTimerId !== null) {
    clearInterval(autoSyncTimerId);
    autoSyncTimerId = null;
    console.log("自动同步已停止");
  }
};

// 监听存储变化，当同步设置变化时重新配置自动同步
browser.storage.onChanged.addListener(async (changes) => {
  if (changes.syncSettings) {
    await startAutoSync();
  }
});

export default defineBackground(async () => {
  console.log("Writeathon微信读书同步插件已启动");

  // 初始化自动同步
  await startAutoSync();
});
