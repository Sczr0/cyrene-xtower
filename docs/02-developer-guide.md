# 开发人员配置指南

本指南面向开发人员，介绍了如何在 Cyrene 项目中添加、修改和维护多语言功能。

## 目录

1. [基本概念](#基本概念)
2. [添加新的翻译键](#添加新的翻译键)
3. [更新 locales.ts 文件](#更新-locales-ts-文件)
4. [添加新的本地化模块](#添加新的本地化模块)
5. [配置 Paraglide](#配置-paraglide)
6. [常见开发任务](#常见开发任务)
7. [调试与测试](#调试与测试)

## 基本概念

在开始之前，了解以下基本概念很重要：

### 翻译键类型

项目中有两种主要的翻译键类型：

1. **Inlang 消息键** - 存储在 `messages/` 目录下的 JSON 文件中，适用于简单文本和模板消息
2. **TypeScript 翻译对象** - 定义在 `src/lib/i18n/locales.ts` 中，适用于结构化的复杂文本

### 翻译作用域

翻译文本按作用域组织：

- `site` - 网站全局文本，如标题、描述等
- `hero` - 首页英雄区文本
- `form` - 表单相关文本
- `buckets` - 桶形图文本
- `results` - 结果页文本
- `docs` - 文档文本
- `apiErrors` - API 错误文本
- `engineErrors` - 引擎错误文本

## 添加新的翻译键

### 对于简单文本和模板

1. 在 `messages/en.json` 中添加新键，如：

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "hello_world": "Hello, {name} from en!",
  "new_message_key": "This is a new message."
}
```

2. 在相应的其他语言文件中添加翻译，如 `messages/zh-cn.json`：

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "hello_world": "Hello, {name} from zh-cn!",
  "new_message_key": "这是一条新消息。"
}
```

### 对于结构化文本

1. 在 `src/lib/i18n/locales.ts` 中的 `LocaleText` 类型中添加新字段

```typescript
export type LocaleText = {
  // 现有字段...
  docs: {
    usageTitle: string;
    usage: string[];
    modelTitle: string;
    model: string[];
    noticeTitle: string;
    notice: string[];
    // 新添加的字段
    newSection: {
      title: string;
      description: string;
    };
  };
  // 其他字段...
};
```

2. 在 `zhCN` 对象中添加相应内容

```typescript
const zhCN: LocaleText = {
  // 现有内容...
  docs: {
    usageTitle: '使用说明',
    usage: [
      '选择游戏与卡池，并填写目前垫抽与保底状态。',
      '「期望抽数」使用数学模型进行快速估计。',
      '「模拟分布」使用蒙特卡洛模拟，给出概率区间与预算达成概率。'
    ],
    modelTitle: '模型说明',
    model: ['角色池下的蒙特卡洛模拟次数更高，因此计算时间略长。'],
    noticeTitle: '注意事项',
    notice: ['所有结果仅供参考，不代表官方概率与实际抽卡结果。'],
    // 新添加的内容
    newSection: {
      title: '新章节',
      description: '这是新添加的章节内容。'
    }
  }
  // 其他内容...
};
```

3. 如果需要，在其他语言对象中添加相应内容

## 更新 locales.ts 文件

### 修改翻译内容

1. 找到 `src/lib/i18n/locales.ts` 文件
2. 修改相应语言对象中的翻译内容

```typescript
const zhCN: LocaleText = {
  // ... 其他内容
  site: {
    title: '米游抽卡期望与分布计算器',
    description: '提供原神、崩坏：星穹铁道与绝区零的抽卡期望值与分布计算。支持自定义保底、命定值与蒙特卡洛模拟。',
    // 修改其他字段...
  }
  // ... 其他内容
};
```

3. 确保所有语言版本都得到更新

### 修改默认语言

如需更改默认语言，修改 `defaultLocale` 变量：

```typescript
export const defaultLocale: LocaleKey = 'zh-cn'; // 改为您想要的默认语言
```

## 添加新的本地化模块

如果需要添加全新的功能模块和对应的翻译，需要：

1. 在 `LocaleText` 类型中添加新模块

```typescript
export type LocaleText = {
  // 现有模块...
  // 新模块
  newFeature: {
    title: string;
    description: string;
    buttons: {
      confirm: string;
      cancel: string;
    };
    messages: {
      success: string;
      error: string;
    };
  };
};
```

2. 在所有语言对象中添加实现

3. 在 Svelte 组件中使用

```svelte
<script>
  import { getLocaleText } from '$lib/i18n/locales';
  const t = getLocaleText();
</script>

<h1>{t.newFeature.title}</h1>
<p>{t.newFeature.description}</p>
<button>{t.newFeature.buttons.confirm}</button>
```

## 配置 Paraglide

### 修改 Inlang 项目配置

`project.inlang/settings.json` 包含 Paraglide 的配置：

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@4/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-m-function-matcher@2/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{locale}.json"
  },
  "baseLocale": "en",
  "locales": ["en", "zh-cn", "zh-tw"]
}
```

要添加新语言，请更新 `locales` 数组：

```json
"locales": ["en", "zh-cn", "zh-tw", "ja"]
```

### 修改中间件配置

`src/hooks.server.ts` 包含 Paraglide 中间件配置：

```typescript
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
    });
  });

export const handle: Handle = handleParaglide;
```

## 常见开发任务

### 更新现有翻译

1. 找到需要更新的翻译键
2. 修改相应语言文件中的值
3. 确保所有语言版本保持同步

### 删除翻译键

1. 从 `messages/en.json` 中删除键
2. 从其他语言文件中删除相应键
3. 更新 `src/lib/i18n/locales.ts` 中的类型定义和实现

### 添加参数化消息

对于需要参数的翻译，使用 Inlang 的消息格式：

在 `messages/en.json` 中：
```json
{
  "welcome_message": "Welcome, {name}!"
}
```

在组件中使用：
```svelte
<script>
  import { hello_world } from '$lib/paraglide/messages/hello_world.js';
  
  const message = hello_world({ name: 'Alice' });
</script>

<p>{message}</p>
```

## 调试与测试

### 本地测试多语言

1. 启动开发服务器：

```bash
pnpm dev
```

2. 在浏览器中访问不同语言的路径，如：
   - `/en` - 英语
   - `/zh-cn` - 简体中文
   - `/zh-tw` - 繁体中文

### 检查缺失的翻译

1. 使用浏览器开发者工具检查控制台中的错误信息
2. 检查页面是否显示未翻译的键名，这表示缺少翻译

### 验证回退机制

1. 故意删除某个语言的翻译
2. 检查页面是否正确显示回退语言的内容