# 新增语言支持指南

本指南介绍了如何为 Cyrene 项目添加新的语言支持，包括完整的步骤和注意事项。

## 目录

1. [准备工作](#准备工作)
2. [配置 Inlang 项目设置](#配置-inlang-项目设置)
3. [创建翻译文件](#创建翻译文件)
4. [更新 TypeScript 类型定义](#更新-typescript-类型定义)
5. [修改 locales.ts 文件](#修改-locales-ts-文件)
6. [更新默认语言设置](#更新默认语言设置)
7. [测试新语言](#测试新语言)
8. [维护和更新](#维护和更新)

## 准备工作

在添加新语言之前，请确保：

1. 您熟悉项目的多语言架构（参考 [多语言架构概述](./01-architecture-overview.md)）
2. 您了解项目的翻译规范（参考 [翻译人员工作指南](./03-translator-guide.md)）
3. 您有权限修改项目文件和配置

同时，需要确定以下信息：

- 新语言的 ISO 639-1 代码（例如日语为 `ja`，韩语为 `ko`）
- 是否需要从特定语言回退（通常是 `zh-cn`）
- 新语言的方向性（从左到右或从右到左）

## 配置 Inlang 项目设置

1. 打开 `project.inlang/settings.json` 文件
2. 将新语言添加到 `locales` 数组中：

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
  "baseLocale": "zh-cn",
  "locales": ["zh-cn", "en", "zh-tw", "ja"]
}
```

3. 保存文件

## 创建翻译文件

1. 在 `messages/` 目录下创建新的语言文件，文件名使用语言代码：

例如，为日语创建 `messages/ja.json`

2. 复制基础语言文件的内容作为起点：

```bash
cp messages/en.json messages/ja.json
```

3. 翻译 `messages/ja.json` 中的内容，保持 JSON 结构不变：

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "hello_world": "こんにちは、{name} from ja!"
}
```

4. 确保翻译文件符合 Inlang 消息格式规范

## 更新 TypeScript 类型定义

1. 打开 `src/lib/i18n/locales.ts` 文件
2. 在 `LocaleKey` 类型中添加新语言：

```typescript
export type LocaleKey = 'en' | 'zh-cn' | 'zh-tw' | 'ja';
```

3. 为新语言创建翻译对象，可以先从现有语言复制内容，再进行翻译：

```typescript
const ja: LocaleText = {
  site: {
    title: 'ミホ Yoo カード期待値＆分布計算機',
    description:
      '原神、崩壊：スターレイル、ゼニゼ口のカード期待値と分布計算を提供します。カスタム保証、運命値、モンテカルロシミュレーションをサポート。',
    keywords:
      'カード,原神,スターレイル,ゼニゼ口,カードシミュレーション,保証,運命値,確率計算,期待,モンテカルロ,zzz,genshin',
    ogLocale: 'ja_JP',
    currency: 'JPY',
    author: 'Cyrene'
  },
  // ... 其他翻译内容
};
```

4. 将新语言对象添加到 `locales` 记录中：

```typescript
export const locales: Record<LocaleKey, LocaleText> = {
  'zh-cn': zhCN,
  en: fallback,
  'zh-tw': fallback,
  ja: ja // 新添加的语言
};
```

5. 确保 `getLocaleText` 函数能正确处理新语言

## 修改 locales.ts 文件

除了上述更改外，还需要确保所有必要的翻译字段都已添加。检查以下内容：

1. 所有结构化文本都已翻译
2. 所有函数参数类型正确
3. 回退机制正确配置

如果新语言需要从特定语言回退，可以设置：

```typescript
const fallback = zhCN; // 设置回退语言
```

## 更新默认语言设置

如果新语言将成为默认语言，需要修改 `defaultLocale`：

```typescript
export const defaultLocale: LocaleKey = 'ja'; // 改为您新添加的语言
```

## 测试新语言

1. 启动开发服务器：

```bash
pnpm dev
```

2. 在浏览器中访问新语言的路径，例如 `/ja`

3. 检查页面是否正确显示新语言的翻译

4. 检查控制台是否有错误信息

5. 测试回退机制（如果配置了），确保当缺少翻译时能正确回退

## 维护和更新

添加新语言后，需要考虑以下维护工作：

1. **保持翻译同步** - 定期更新翻译文件，确保与基础语言保持同步
2. **添加新翻译** - 当添加新功能时，为新语言提供相应翻译
3. **质量检查** - 定期检查翻译质量和一致性
4. **性能优化** - 如果语言文件过大，考虑进行性能优化
5. **文档更新** - 更新相关文档，包括术语表和翻译指南

## 注意事项

1. **语言方向性** - 如果新语言是从右到左（RTL）的语言（如阿拉伯语），可能需要额外的样式调整
2. **字体支持** - 确保页面字体支持新语言的字符
3. **格式化** - 不同语言可能有不同的日期、时间、数字格式化习惯
4. **文化差异** - 考虑文化差异对用户体验的影响
5. **法律要求** - 某些国家/地区可能有关于语言使用的特定法律要求

## 总结

为项目添加新语言支持是一个系统性的过程，需要涉及多个文件和配置。通过遵循本指南中的步骤，您可以成功为项目添加新的语言支持，并确保其正常工作。
