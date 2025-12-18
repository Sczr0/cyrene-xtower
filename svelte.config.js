import { mdsvex } from 'mdsvex';
import cloudflare from '@sveltejs/adapter-cloudflare';
import node from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const adapterTarget =
	process.env.SVELTEKIT_ADAPTER ??
	(process.env.CF_PAGES ? 'cloudflare' : 'node');

const kitAdapter =
	adapterTarget === 'cloudflare'
		? cloudflare()
		: adapterTarget === 'static'
			? staticAdapter({
					pages: 'build-static',
					assets: 'build-static'
				})
			: node();

const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],
	onwarn: (warning, handler) => {
		// 关闭部分无障碍相关告警，便于后续多语言与结构重构
		if (warning.code === 'a11y-label-has-associated-control') return;
		if (warning.code === 'element_invalid_self_closing_tag') return;
		handler(warning);
	},
	kit: {
		adapter: kitAdapter,
		// SEO 友好：为每个语言输出独立静态入口页
		prerender: {
			entries: ['/', '/en/', '/zh-tw/']
		}
	},
	extensions: ['.svelte', '.svx']
};

export default config;
