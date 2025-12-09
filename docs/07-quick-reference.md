# 快速参考手册

本文档提供了多语言功能的常用命令和代码片段的快速参考，帮助开发人员和翻译人员快速查找所需信息。

## 目录

1. [常用命令](#常用命令)
2. [代码片段](#代码片段)
3. [文件结构](#文件结构)
4. [API 参考](#api-参考)
5. [常见错误及解决方案](#常见错误及解决方案)
6. [工具和资源](#工具和资源)

## 常用命令

### 启动开发服务器

```bash
pnpm dev
```

### 构建项目

```bash
pnpm build
```

### 检查翻译完整性

```bash
# 创建一个检查脚本
node scripts/check-translations.js
```

### 复制基础语言文件

```bash
# 为新语言创建基础文件
cp messages/en.json messages/ja.json
```

## 代码片段

### 在 Svelte 组件中使用翻译

```svelte
<script>
  import { getLocaleText } from '$lib/i18n/locales';
  const t = getLocaleText();
</script>

<h1>{t.hero.title}</h1>
<p>{t.hero.description}</p>
```

### 使用 Inlang 消息

```svelte
<script>
  import { hello_world } from '$lib/paraglide/messages/hello_world.js';
  
  const message = hello_world({ name: 'Alice' });
</script>

<p>{message}</p>
```

### 动态参数化翻译

```typescript
// 在 locales.ts 中定义
const zhCN: LocaleText = {
  docs: {
    dynamicMessage: ({ name, count }) => `${name} 有 ${count} 个项目`
  }
};

// 在组件中使用
<t.docs.dynamicMessage({ name: '张三', count: 5 }) />
```

### 格式化数字和货币

```typescript
// 数字格式化
const number = new Intl.NumberFormat(locale).format(1234567.89);

// 日期格式化
const date = new Intl.DateTimeFormat(locale).format(new Date());

// 货币格式化
const currency = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'CNY'
}).format(99.99);
```

### 复数支持

```json
{
  "item_count": "{count, plural, one {# 项} other {# 项}}"
}
```

## 文件结构

### 项目多语言文件结构

```
d:/git/cyrene.xtower.site/cyrene-xtower/
├── messages/
│   ├── en.json
│   ├── zh-cn.json
│   └── zh-tw.json
├── project.inlang/
│   ├── settings.json
│   └── cache/
├── src/
│   ├── lib/
│   │   ├── i18n/
│   │   │   └── locales.ts
│   │   └── paraglide/
│   │       ├── messages/
│   │       ├── runtime.js
│   │       └── server.js
│   ├── hooks.server.ts
│   ├── hooks.ts
│   └── routes/
│       ├── +layout.svelte
│       └── +page.svelte
```

### JSON 消息文件格式

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "hello_world": "Hello, {name} from en!",
  "button_submit": "Submit"
}
```

### TypeScript 类型定义示例

```typescript
export type LocaleText = {
  site: {
    title: string;
    description: string;
  };
  hero: {
    title: string;
    description: string;
  };
  // ... 其他类型定义
};
```

## API 参考

### getLocaleText

获取当前语言的翻译文本对象。

```typescript
import { getLocaleText } from '$lib/i18n/locales';

const t = getLocaleText();
// 使用 t 访问翻译文本
```

### getLocale

获取当前语言代码。

```typescript
import { getLocale } from '$lib/paraglide/runtime';

const locale = getLocale();
// 返回当前语言代码，如 'zh-cn'
```

### paraglideMiddleware

Paraglide 中间件，用于处理服务器端语言检测和路由。

```typescript
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
    });
  });
```

## 常见错误及解决方案

### 错误: 找不到翻译键

**原因**: 在翻译文件中找不到指定的键。

**解决方案**:
1. 检查键名是否正确
2. 确认翻译文件已更新
3. 使用回退机制确保始终有文本显示

### 错误: 参数化翻译参数不匹配

**原因**: 传递的参数与翻译模板中的占位符不匹配。

**解决方案**:
1. 检查参数名是否与占位符名一致
2. 确保所有必需的参数都已传递

### 错误: 未定义的语言代码

**原因**: 使用了未定义的语言代码。

**解决方案**:
1. 检查 `LocaleKey` 类型定义
2. 确认语言已添加到 `project.inlang/settings.json`
3. 更新 `locales.ts` 文件中的语言映射

### 错误: 翻译文件格式错误

**原因**: JSON 格式错误或缺少必需的字段。

**解决方案**:
1. 使用 JSON 验证工具检查文件格式
2. 确保包含必需的 `$schema` 字段
3. 检查所有引号和逗号是否正确

## 工具和资源

### Inlang Paraglide-js

- [官方文档](https://inlang.com/m/gerre34r/paraglide-js)
- [GitHub 仓库](https://github.com/opral/inlang-paraglide-js)
- [消息格式规范](https://inlang.com/m/gerre34r/library-inlang-messageFormat)

### 翻译工具

- [JSON 编辑器](https://jsoneditoronline.org/) - 在线 JSON 编辑和验证
- [Diff 检查工具](https://www.diffchecker.com/) - 比较文件差异
- [Unicode 字符检查器](https://unicode-table.com/) - 检查特殊字符

### 语言资源

- [ISO 639-1 语言代码](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) - 官方语言代码列表
- [Unicode CLDR](https://cldr.unicode.org/) - 通用语言环境数据库

### 测试工具

- [BrowserStack](https://www.browserstack.com/) - 跨浏览器测试
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - 性能和可访问性测试

## 总结

本快速参考手册提供了一些最常用的命令、代码片段和资源，帮助您快速查找所需信息。如果您需要更详细的信息，请参考相关指南文档。