## 测试执行记录 2025-11-17, Codex
- 命令：`pnpm test`
- 结果：  
  - `src/demo.spec.ts`（纯 Node 测试）通过；  
  - `src/routes/page.svelte.spec.ts`（浏览器端测试）失败，原因是新页面已不再渲染 `<h1>` 标题，断言找不到 `heading level 1` 元素；  
  - Vite/Svelte 插件输出了一些无障碍告警（`href="#"` 与未关联的 `<label>`），但未阻断测试运行。  
- 之前的 Playwright 浏览器缺失错误依旧存在，需要本地执行 `pnpm exec playwright install` 以完整运行浏览器测试环境。  
- 本次改动新增 TypeScript 抽卡核心模块（原神角色池数学期望与模拟），尚未接入 `/api/gacha`，因此当前前端功能仍依赖 Python 版本；迁移逻辑的正确性后续需通过对照测试进一步验证。

## 测试执行记录 2025-11-19, Codex
- 命令：`pnpm test`
- 结果：  
  - `src/demo.spec.ts`、`src/routes/page.svelte.spec.ts`、`src/lib/gacha/compare-python.spec.ts` 共 3 个测试文件全部通过，合计 13 个用例；  
  - 运行期间 Vite/Svelte 插件继续提示 `src/routes/+page.svelte` 中若干 `<label>` 未关联控件以及 `<div />` 自闭合标签的无障碍告警，为既有问题，本次 SEO 相关改动未新增新的告警或错误。
