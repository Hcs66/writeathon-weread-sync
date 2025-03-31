import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue','@wxt-dev/auto-icons'],
  manifest: {
    name: 'Writeathon微信读书同步',
    description: '同步微信读书笔记到Writeathon',
    permissions: ['storage', 'cookies'],
    host_permissions: ['*://*.weread.qq.com/*', '*://*.writeathon.cn/*']
  },
  vite: ()=>({
    plugins: [
      tailwindcss(),
    ]
  })
});
