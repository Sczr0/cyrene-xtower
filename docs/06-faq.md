# 常见问题解答

本文档提供了多语言功能相关问题的常见问题和解答，帮助开发人员和翻译人员快速解决遇到的问题。

## 目录

1. [开发相关问题](#开发相关问题)
2. [翻译相关问题](#翻译相关问题)
3. [测试和调试](#测试和调试)
4. [性能问题](#性能问题)
5. [语言支持](#语言支持)
6. [其他常见问题](#其他常见问题)

## 开发相关问题

### Q: 如何添加新的翻译键？

**A:** 参考 [开发人员配置指南](./02-developer-guide.md#添加新的翻译键) 了解详细步骤。简单来说，对于简单文本，在 `messages/en.json` 中添加键，然后在其他语言文件中添加对应翻译；对于结构化文本，在 `src/lib/i18n/locales.ts` 中更新类型定义和实现。

### Q: 如何在组件中使用翻译文本？

**A:** 使用 `getLocaleText` 函数获取当前语言的翻译文本：

```svelte
<script>
  import { getLocaleText } from '$lib/i18n/locales';
  const t = getLocaleText();
</script>

<h1>{t.hero.title}</h1>
<p>{t.hero.description}</p>
```

### Q: 如何处理参数化翻译？

**A:** 对于简单文本，使用 Inlang 的消息格式：

```svelte
<script>
  import { hello_world } from '$lib/paraglide/messages/hello_world.js';
  
  const message = hello_world({ name: 'Alice' });
</script>

<p>{message}</p>
```

对于结构化文本，在 `locales.ts` 中使用函数类型：

```typescript
export type LocaleText = {
  docs: {
    dynamicMessage: (params: { name: string; count: number }) => string;
  };
};

const zhCN: LocaleText = {
  docs: {
    dynamicMessage: ({ name, count }) => `${name} 有 ${count} 个项目`
  }
};

// 在组件中使用
<t.docs.dynamicMessage({ name: '张三', count: 5 }) />
```

### Q: 如何添加复数支持？

**A:** 使用 Inlang 的复数语法：

```json
{
  "item_count": "{count, plural, one {# 项} other {# 项}}"
}
```

### Q: 如何处理不同语言的日期、数字格式化？

**A:** 使用 JavaScript 的 `Intl` API：

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

## 翻译相关问题

### Q: 如何处理专有名词和游戏术语？

**A:** 对于专有名词，优先使用官方翻译。如果没有官方翻译，可以在术语表中说明选择，并保持一致性。请参考 [翻译人员工作指南](./03-translator-guide.md#术语表) 中的术语表。

### Q: 翻译文件中的 `$schema` 字段是什么？

**A:** `$schema` 字段指定了翻译文件遵循的 JSON 格式规范，应该保留不变。它帮助编辑器提供正确的语法检查和自动补全功能。

### Q: 如何处理文化差异？

**A:** 在保持原意的基础上，适当调整表达方式以适应目标语言的文化习惯。例如，对于一些笑话或习语，可能需要意译而不是直译。可以参考 [翻译人员工作指南](./03-translator-guide.md#翻译规范) 中的指导。

### Q: 翻译文件中的占位符如何处理？

**A:** 不要翻译占位符（如 `{name}`），保持原样。这些占位符会在运行时被实际值替换。

### Q: 如何检查翻译的完整性？

**A:** 可以使用 diff 工具比较您的翻译文件和基础语言文件，确保所有键都有对应的翻译。也可以编写自动化脚本来检查缺失的翻译。

## 测试和调试

### Q: 如何在开发环境中测试不同语言？

**A:** 启动开发服务器后，在浏览器中访问不同语言的路径，如 `/en`、`/zh-cn`、`/zh-tw`。也可以通过 URL 参数 `?lang=en` 指定语言。

### Q: 如何检查未翻译的文本？

**A:** 
1. 检查页面是否显示未翻译的键名，这表示缺少翻译
2. 在浏览器开发者工具的控制台中查找错误信息
3. 使用自动化脚本检查所有语言的翻译完整性

### Q: 如何模拟翻译缺失的情况？

**A:** 可以临时删除某个语言的翻译文件中的部分内容，然后测试回退机制是否正常工作。

### Q: 如何调试翻译参数问题？

**A:** 
1. 检查传递的参数是否正确
2. 确保参数名与翻译模板中的占位符名一致
3. 使用浏览器开发者工具检查渲染后的文本

## 性能问题

### Q: 多语言功能是否会影响性能？

**A:** 适当的实现对性能影响很小。可以采取以下优化措施：
1. 按需加载翻译文件
2. 缓存已加载的翻译
3. 最小化翻译文件大小

### Q: 如何优化翻译文件的加载？

**A:** 对于大型应用，可以考虑按需加载翻译：

```typescript
// 只加载当前语言需要的翻译
async function loadLocaleText(locale) {
  if (locale === 'zh-cn') {
    return await import('$lib/i18n/locales/zh-cn');
  }
  // ... 其他语言
}
```

### Q: 如何减少翻译文件的大小？

**A:** 
1. 移除未使用的翻译键
2. 使用缩写形式（如 `btnOk` 而不是 `buttonOk`）
3. 压缩空白字符

## 语言支持

### Q: 如何添加新语言支持？

**A:** 参考 [新增语言支持指南](./04-adding-new-languages.md) 了解详细步骤。需要在 `project.inlang/settings.json` 中添加新语言，创建对应的翻译文件，并更新 TypeScript 类型定义。

### Q: 项目目前支持哪些语言？

**A:** 当前项目支持：
- 英语 (en) - 基础语言
- 简体中文 (zh-cn) - 默认语言
- 繁体中文 (zh-tw) - 部分翻译，使用简体中文作为回退

### Q: 是否支持从右到左的语言？

**A:** 项目框架支持从右到左的语言，但需要进行额外配置：
1. 在 HTML 中添加 `dir="rtl"` 属性
2. 调整 CSS 样式以适应 RTL 显示
3. 测试所有组件在 RTL 环境下的显示

### Q: 如何设置默认语言？

**A:** 在 `src/lib/i18n/locales.ts` 中修改 `defaultLocale` 变量：

```typescript
export const defaultLocale: LocaleKey = 'zh-cn'; // 改为您想要的默认语言
```

## 其他常见问题

### Q: 如何处理 HTML 标签在翻译中的使用？

**A:** 可以在翻译中包含 HTML 标签，但需要确保：
1. 标签语法正确
2. 标签不会被翻译
3. 适当转义特殊字符

```json
{
  "messageWithLink": "点击 <a href=\"/link\">这里</a> 查看更多信息"
}
```

在组件中使用时，可能需要使用 `{@html}` 指令：

```svelte
<p>{@html t.messageWithLink}</p>
```

但请注意，直接使用 `{@html}` 可能存在 XSS 风险，应该确保翻译内容是可信的。

### Q: 如何处理特殊字符和转义？

**A:** 
1. 使用 UTF-8 编码保存所有翻译文件
2. JSON 中的特殊字符需要转义，如 `\"`、`\\`、`\/`、`\b`、`\f`、`\n`、`\r`、`\t`
3. 在 HTML 中显示时，考虑使用适当的转义函数

### Q: 如何处理翻译版本冲突？

**A:** 
1. 使用版本控制系统管理翻译文件
2. 为每次翻译更改创建单独的分支
3. 使用清晰的提交消息描述更改
4. 定期合并翻译更新

### Q: 多语言网站如何进行 SEO 优化？

**A:** 
1. 为每种语言创建独立的 URL 路径
2. 使用 hreflang 标签指示页面语言
3. 为每种语言提供独立的 sitemap
4. 考虑使用 CDN 提供地理位置优化

### Q: 如何处理不同语言的文本方向和排版？

**A:** 
1. 从左到右的语言使用默认设置
2. 从右到左的语言需要：
   - 设置 `dir="rtl"` 属性
   - 调整 CSS 样式以适应 RTL 显示
   - 测试所有组件在 RTL 环境下的显示

### Q: 如何处理数字、日期和货币的本地化？

**A:** 使用 JavaScript 的 `Intl` API 进行格式化：

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

### Q: 如何处理长文本的换行和截断？

**A:** 
1. 使用 CSS 的 `word-wrap` 和 `overflow-wrap` 属性处理长单词
2. 设置合理的文本截断规则
3. 在不同语言环境下测试长文本的显示效果

### Q: 如何处理不同语言的标点符号？

**A:** 不同语言使用不同的标点符号习惯：
1. 中文使用全角标点符号，如，。？！；
2. 英文使用半角标点符号，如 ,.!?;
3. 引号的使用也不同，如中文使用「」或『』，英文使用 "" 或 ''

翻译时应该使用目标语言习惯的标点符号。

### Q: 如何处理不同语言的空格习惯？

**A:** 不同语言对空格的使用习惯不同：
1. 英文在单词之间使用一个空格
2. 中文通常不使用空格
3. 某些语言可能在标点符号前后使用空格

翻译时应该使用目标语言习惯的空格规则。

## 总结

以上是一些关于多语言功能的常见问题及解答。如果您遇到其他问题，请参考相关指南文档或联系项目维护者。