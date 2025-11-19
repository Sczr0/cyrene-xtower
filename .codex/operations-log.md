## 2025-11-17 Codex 操作日志

- 创建 `.codex/context-scan.json`，记录抽卡计算器参数与项目结构概览。
- 计划在 `src/routes/api/gacha/+server.ts` 中实现调用 `test.py` 的后端 API。
- 计划重写 `src/routes/+page.svelte` 为抽卡期望仪表盘页面，参考 `test.png` 布局。
- 已实现 `src/routes/api/gacha/+server.ts`，通过 `child_process.spawn` 调用根目录下 `test.py`，并提供统一 JSON 响应结构。
- 调整 `src/routes/+page.svelte` 表单交互：明光计数仅在「原神 + 角色池」下展示，命定值仅在「原神 + 武器池」下展示，UP 四星满命开关仅在角色池显示，减少对星铁等其他游戏用户的困惑。
- 修正保底状态选择逻辑：避免由 `<select>` 绑定导致的字符串 `'false'` 被当作 `true` 传入服务器的问题，在 `+server.ts` 中显式解析字符串布尔值。
- 在 `src/lib/gacha` 下搭建 TS 抽卡核心模块骨架，包括 `core` 公共类型与 RNG、各游戏/卡池的 `Math` 与 `Sim` 文件，以及统一入口 `engine.ts`，为后续从 `test.py` 迁移具体算法做准备。
- 已迁移原神角色池数学期望与蒙特卡洛模拟实现到 `src/lib/gacha/genshin/characterMath.ts` 与 `characterSim.ts`，并实现通用线性方程求解 `core/matrix.ts`。
- 已实现星穹铁道角色池数学期望与模拟：`hsr/characterMath.ts` 复刻 `HSRCharacterModel` 矩阵模型，`hsr/characterSim.ts` 复刻 `HSRCharacterLogic`（含 56.25/43.75 胜率与星芒返还）。
- 已实现绝区零角色池数学期望与模拟：`zzz/characterMath.ts` 复用星铁角色池期望模型，`zzz/characterSim.ts` 复刻 `ZZZCharacterLogic`（含 0.094 四星触发与信号余波返还）。
- 已实现原神武器池数学期望与模拟：`genshin/weaponMath.ts` 复刻 `GenshinWeaponModel`，`genshin/weaponSim.ts` 复刻 `GenshinWeaponLogic`（含命定值、37.5/62.5 小保底与星辉返还）。
- 已实现星穹铁道光锥池与绝区零武器池的期望与模拟：`hsr/lightConeMath.ts` + `hsr/lightConeSim.ts`，`zzz/weaponMath.ts` + `zzz/weaponSim.ts`，并通过 Python 对照测试验证。
- 重写 `src/routes/api/gacha/+server.ts`：`mode='expectation'` 时改为调用 TS 抽卡引擎（不再启动 Python），`mode='distribution'` 仍通过 `test.py` 进行 Monte Carlo 模拟，保持前端 API 响应结构不变。

[] update +page.svelte homepage layout and copy (by Codex AI)

[] doubled MC simulation counts and enabled returns percentiles for genshin/zzz weapon pools (by Codex AI)

## 2025-11-19 Codex 操作日志

- 为全局布局 `src/routes/+layout.svelte` 增加中文 SEO 元信息：在 `<svelte:head>` 中输出页面标题、描述、关键词、OG/Twitter meta 标签以及 `WebApplication` 类型的 JSON-LD 结构化数据，统一引用抽卡期望计算器的中文文案，提升首页在中文搜索引擎中的可读性与可预览性。
- 保持现有 `robots.txt` 与路由结构不变，避免在未确认实际域名的前提下写死 canonical 链接或 sitemap 地址，SEO 优化仅围绕 HTML `<head>` 内容展开，确保改动风险可控。
- 使用 `pnpm test` 运行 Vitest 测试套件，3 个测试文件共 13 个用例全部通过，仅输出与表单 `<label>` 关联和 `<div />` 自闭合相关的既有无障碍告警，未引入新的错误或断言失败。
