import { WriteathonSettings } from "../types";
import { storageService } from "./storage";

// Writeathon API基础URL
const API_BASE_URL = !import.meta.env.DEV
  ? "https://api.writeathon.cn"
  : "http://localhost:7001"; // 'https://api.writeathon.cn';

// 延迟函数
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Writeathon服务
export const writeathonService = {
  // 验证凭证
  async validateCredentials(settings: WriteathonSettings): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/me`, {
        method: "GET",
        headers: {
          "x-writeathon-token": settings.apiToken,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.success && data.data.id === settings.userId;
    } catch (error) {
      console.error("验证Writeathon凭证失败:", error);
      return false;
    }
  },

  // 获取用户信息
  async getUserInfo(
    settings: WriteathonSettings
  ): Promise<{ username: string } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/me`, {
        method: "GET",
        headers: {
          "x-writeathon-token": settings.apiToken,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.success && data.data) {
        return { username: data.data.username || "未知用户" };
      }
      return null;
    } catch (error) {
      console.error("获取Writeathon用户信息失败:", error);
      return null;
    }
  },

  // 创建卡片
  async createCard(
    settings: WriteathonSettings,
    title: string,
    content: string
  ): Promise<boolean> {
    try {
      // 在发送请求前等待设定的延迟时间
      // api接口QPS=30, 335ms = 10QPS, 100ms = 30QPS
      await delay(140);

      const response = await fetch(
        `${API_BASE_URL}/v1/users/${settings.userId}/cards`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-writeathon-token": settings.apiToken,
          },
          body: JSON.stringify({ title, content }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("创建Writeathon卡片失败:", errorData);
        return false;
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("创建Writeathon卡片失败:", error);
      return false;
    }
  },

  // 获取最近的卡片列表
  async getRecentCards(settings: WriteathonSettings): Promise<any[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/users/${settings.userId}/cards/recent?exclude_date_title=true`,
        {
          method: "GET",
          headers: {
            "x-writeathon-token": settings.apiToken,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("获取Writeathon卡片列表失败:", errorData);
        return [];
      }

      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error("获取Writeathon卡片列表失败:", error);
      return [];
    }
  },

  // 获取卡片内容
  async getCard(
    settings: WriteathonSettings,
    title: string
  ): Promise<any | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/users/${settings.userId}/cards/get`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-writeathon-token": settings.apiToken,
          },
          body: JSON.stringify({ title }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("获取Writeathon卡片内容失败:", errorData);
        return null;
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error("获取Writeathon卡片内容失败:", error);
      return null;
    }
  },
};
