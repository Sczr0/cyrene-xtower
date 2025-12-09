# 多语言最佳实践

本文档介绍了 Cyrene 项目中多语言功能的最佳实践，旨在帮助开发人员和翻译人员高效地使用和维护多语言功能。

## 目录

1. [设计多语言友好的应用](#设计多语言友好的应用)
2. [组织翻译内容](#组织翻译内容)
3. [开发流程最佳实践](#开发流程最佳实践)
4. [翻译质量保证](#翻译质量保证)
5. [性能优化](#性能优化)
6. [可维护性](#可维护性)
7. [常见陷阱与解决方案](#常见陷阱与解决方案)

## 设计多语言友好的应用

### 避免硬编码文本

永远不要在代码中硬编码显示给用户的文本。应该：

```typescript
// 错误做法
return `<h1>欢迎使用抽卡模拟器</h1>`;

// 正确做法
import { getLocaleText } from '$lib/i18n/locales';
const t = getLocaleText();
return `<h1>${t.hero.title}</h1>`;
```

### 考虑文本长度变化

不同语言的文本长度可能有很大差异，设计UI时应考虑这一点：

- 使用弹性布局，避免固定宽度
- 测试不同语言的显示效果
- 考虑长文本的换行和截断策略

### 处理复数和性别

对于需要处理复数和性别的语言，使用适当的语法：

```typescript
// 使用 Inlang 的复数语法
"item_count": "{count, plural, one {# 项} other {# 项}}"
```

### 格式化日期、数字和货币

使用 Intl API 进行本地化格式化：

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

## 组织翻译内容

### 使用有意义的键名

使用描述性的键名，便于理解和维护：

```json
// 好的做法
{
  "form.targetLabel": "目标数量",
  "results.successCard.title": "预算达成概率"
}

// 避免的做法
{
  "t1": "目标数量",
  "t2": "预算达成概率"
}
```

### 按功能模块组织

将相关的翻译组织在一起：

```typescript
// 在 locales.ts 中
export type LocaleText = {
  form: {
    basicsTitle: string;
    targetLabel: string;
    // ... 其他表单相关翻译
  };
  results: {
    heading: string;
    summary: string;
    // ... 其他结果页翻译
  };
  // ... 其他模块
};
```

### 避免在翻译键中使用点号

在 Inlang 消息格式中，点号有特殊含义，应避免在键名中使用：

```json
// 避免的做法
{
  "form.target.label": "目标数量"
}

// 正确做法
{
  "formTargetLabel": "目标数量"
}
```

## 开发流程最佳实践

### 提前规划翻译

在开发新功能时，提前考虑多语言需求：

1. 设计阶段就确定需要翻译的文本
2. 准备键名和上下文说明
3. 与翻译人员沟通特殊要求

### 使用翻译占位符

对于可能变化的文本，使用占位符而不是字符串拼接：

```json
// 好的做法
{
  "welcomeMessage": "欢迎，{name}!"
}
```

```svelte
<script>
  import { getLocaleText } from '$lib/i18n/locales';
  const t = getLocaleText();
</script>

<h1>{t.welcomeMessage({ name: userName })}</h1>
```

```json
// 避免的做法
{
  "welcomeMessage": "欢迎，{{name}}!"
}
```

```svelte
<script>
  import { getLocaleText } from '$lib/i18n/locales';
  const t = getLocaleText();
</script>

<h1>{t.welcomeMessage.replace('{{name}}', userName)}</h1>
```

### 分离代码和翻译

保持代码逻辑和翻译内容的分离：

```typescript
// 逻辑处理
function calculatePulls(game, pool, target) {
  // ... 计算逻辑
  return {
    success: true,
    pulls: 100
  };
}

// 界面显示
function displayResult(result) {
  if (result.success) {
    return t.results.successCard.description(result.pulls);
  }
  return t.results.errorMessage;
}
```

### 及时更新翻译

当添加或修改功能时，及时更新所有语言的翻译：

1. 添加新功能后，更新基础语言文件
2. 通知翻译人员添加新翻译
3. 在发布前检查所有语言的完整性

## 翻译质量保证

### 提供上下文

为翻译人员提供充分的上下文信息：

```typescript
// 在代码中添加注释
// 用户点击按钮后显示的成功消息
const successMessage = t.form.actions.success;

// 或者在翻译文件中添加说明
{
  "form.actions.success": "操作成功，显示给用户的反馈消息"
}
```

### 使用翻译记忆

维护一个术语表，确保翻译一致性：

| 英文 | 简体中文 | 繁体中文 | 备注 |
|------|--------|--------|------|
| pity | 垫抽 | 墊抽 | 指抽卡中的保底计数 |
| guarantee | 保底 | 保底 | 指抽卡中的保底机制 |

### 定期审查翻译

定期审查翻译质量：

1. 检查语法和拼写错误
2. 确保术语一致性
3. 验证文化适应性
4. 检查用户体验

## 性能优化

### 按需加载翻译

对于大型应用，考虑按需加载翻译：

```typescript
// 只加载当前语言需要的翻译
async function loadLocaleText(locale) {
  if (locale === 'zh-cn') {
    return await import('$lib/i18n/locales/zh-cn');
  }
  // ... 其他语言
}
```

### 缓存翻译

缓存已加载的翻译文件：

```typescript
const localeCache = new Map();

export function getLocaleText(locale) {
  if (!localeCache.has(locale)) {
    localeCache.set(locale, loadLocaleText(locale));
  }
  return localeCache.get(locale);
}
```

### 最小化翻译文件大小

优化翻译文件大小：

1. 移除未使用的翻译键
2. 使用缩写形式（如 `btnOk` 而不是 `buttonOk`）
3. 压缩空白字符

## 可维护性

### 版本控制

使用版本控制管理翻译文件：

1. 为每次翻译更改创建单独的分支
2. 使用清晰的提交消息描述更改
3. 定期合并翻译更新

### 自动化测试

编写测试确保翻译的完整性：

```typescript
// 测试脚本示例
function checkTranslations() {
  const baseLocale = 'en';
  const locales = ['zh-cn', 'zh-tw'];
  
  // 检查所有语言是否包含所有键
  for (const locale of locales) {
    const baseKeys = getKeys(require(`../messages/${baseLocale}.json`));
    const localeKeys = getKeys(require(`../messages/${locale}.json`));
    
    const missingKeys = baseKeys.filter(key => !localeKeys.includes(key));
    if (missingKeys.length > 0) {
      console.error(`Missing keys in ${locale}:`, missingKeys);
    }
  }
}
```

### 文档化特殊要求

为特殊翻译需求提供文档：

```markdown
# 特殊翻译要求

## 游戏术语
- 原神角色池: "角色池" (不要翻译为"角色UP池")
- 崩坏星穹铁道光锥池: "光锥池" (不要翻译为"光锥UP池")

## 数值格式
- 百分比: 使用 "%" 后缀，如 "25%"
- 货币: 使用对应语言的货币符号
- 数值分隔符: 使用对应语言习惯的分隔符
```

## 常见陷阱与解决方案

### 翻译键缺失

**问题**: 用户看到未翻译的键名而不是实际文本

**解决方案**: 
1. 使用回退机制确保始终有文本显示
2. 自动化检查缺失的翻译
3. 在开发环境中启用翻译完整性检查

### 特殊字符编码

**问题**: 特殊字符显示为乱码

**解决方案**:
1. 使用 UTF-8 编码保存所有翻译文件
2. 确保服务器正确处理 UTF-8 编码
3. 在 HTML 中设置正确的字符集

### RTL 语言支持

**问题**: 从右到左的语言（如阿拉伯语）显示错误

**解决方案**:
1. 使用 CSS `dir="rtl"` 属性
2. 调整布局以适应 RTL 显示
3. 测试所有组件在 RTL 环境下的显示

### 日期和数字格式化

**问题**: 日期和数字格式不符合当地习惯

**解决方案**:
1. 使用 `Intl` API 进行格式化
2. 根据语言设置选择合适的格式
3. 测试不同语言的格式化效果

### 文本长度导致的布局问题

**问题**: 翻译后的文本过长导致布局破坏

**解决方案**:
1. 使用弹性布局
2. 设置合理的文本截断规则
3. 在不同语言环境下测试布局

## 总结

遵循这些最佳实践可以确保多语言功能的高效开发和维护，同时提供良好的用户体验。关键是提前规划、保持一致性和持续改进。