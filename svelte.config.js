import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],
	onwarn: (warning, handler) => {
		// 关闭与 label 关联和自闭合 div 相关的无障碍告警，便于后续多语言与结构重构
		if (warning.code === 'a11y-label-has-associated-control') return;
		if (warning.code === 'element_invalid_self_closing_tag') return;
		handler(warning);
	},
	kit: {
		// 默认使用 Cloudflare 适配器
		adapter: adapter()
	},
	extensions: ['.svelte', '.svx']
};

export default config;

