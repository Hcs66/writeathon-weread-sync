import { defineAppConfig } from '#imports';

declare module "wxt/utils/define-app-config" {
  export interface WxtAppConfig {
    apiUrl: string;
  }
}

export default defineAppConfig({
  apiUrl: !import.meta.env.DEV
    ? "https://api.writeathon.cn"
    : "http://localhost:7001",
});
