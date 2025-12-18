import { deLocalizeUrl } from '$lib/paraglide/runtime';
import type { Transport } from '@sveltejs/kit';

export const reroute = (request) => deLocalizeUrl(request.url).pathname;

// 说明：SvelteKit 会在生成的客户端清单中静态导入 `transport`；即使不自定义序列化，也需要导出一个空对象避免构建期告警/运行期缺失导出。
export const transport: Transport = {};
