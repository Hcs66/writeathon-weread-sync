<script setup lang="ts">
  import { Icon } from "@iconify/vue";
  import { ref } from "vue";
  import pkg from "../package.json";

  // 从package.json获取版本号
  const version = ref(pkg.version);
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-between">
        <h2 class="card-title text-primary">
          <Icon icon="mdi:help-circle" class="mr-2" />
          使用说明
        </h2>
        <span class="text-xs text-gray-500">v{{ version }}</span>
      </div>

      <div class="mt-4 text-sm">
        <div class="collapse collapse-arrow bg-base-200 mb-2">
          <input type="checkbox" checked />
          <div class="collapse-title font-medium">1. 登录微信读书</div>
          <div class="collapse-content">
            <ul class="list-disc pl-5">
              <li>点击「打开微信读书网页版」按钮</li>
              <li>在打开的页面中登录微信读书</li>
              <li>登录成功后返回插件页面</li>
              <li>点击「获取微信读书Cookie」按钮</li>
            </ul>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mb-2">
          <input type="checkbox" />
          <div class="collapse-title font-medium">2. 设置Writeathon</div>
          <div class="collapse-content">
            <ul class="list-disc pl-5">
              <li>点击「打开Writeathon集成设置」按钮</li>
              <li>在Writeathon网站上登录并进入设置→集成页面</li>
              <li>复制API Token和用户ID</li>
              <li>粘贴到输入框中并保存</li>
            </ul>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mb-2">
          <input type="checkbox" />
          <div class="collapse-title font-medium">3. 同步设置</div>
          <div class="collapse-content">
            <ul class="list-disc pl-5">
              <li>选择同步范围（最近1天、最近7天、14天、30天或全部）</li>
              <li>选择自动同步间隔（如需自动同步）</li>
              <li>选择是否合并同一本书的笔记和划线</li>
              <li>保存设置</li>
            </ul>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mb-2">
          <input type="checkbox" />
          <div class="collapse-title font-medium">4. 开始同步</div>
          <div class="collapse-content">
            <ul class="list-disc pl-5">
              <li>点击「开始同步」按钮</li>
              <li>等待同步完成</li>
              <li>查看同步结果和同步历史</li>
            </ul>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mb-2">
          <input type="checkbox" />
          <div class="collapse-title font-medium">5. 查看和管理已同步书籍</div>
          <div class="collapse-content">
            <ul class="list-disc pl-5">
              <li>点击「已同步书籍」标签页查看所有已同步的书籍</li>
              <li>点击书名可以直接跳转到微信读书网页版查看该书</li>
              <li>点击刷新按钮可以更新已同步书籍的数据</li>
            </ul>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mb-2">
          <input type="checkbox" />
          <div class="collapse-title font-medium">6. 从书架同步单本书籍</div>
          <div class="collapse-content">
            <ul class="list-disc pl-5">
              <li>点击「我的书架」标签页查看微信读书书架中的所有书籍</li>
              <li>已同步的书籍会显示"已同步"标签</li>
              <li>点击"同步"或"重新同步"按钮可以单独同步该书的笔记和划线</li>
              <li>同步完成后会显示同步结果提示</li>
            </ul>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mb-2">
          <input type="checkbox" />
          <div class="collapse-title font-medium">7. 注意事项</div>
          <div class="collapse-content">
            <ul class="list-disc pl-5">
              <li>微信读书Cookie有效期约为30天，过期后需要重新获取</li>
              <li>同步到Writeathon的笔记会以书名+笔记作为标题</li>
              <li>笔记内容顶部会自动添加 #微信读书/书名 为标签</li>
              <li>可以在同步历史中查看历次同步的结果</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
