import { mdsvex } from 'mdsvex';
import cloudflare from '@sveltejs/adapter-cloudflare';
import node from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const adapterTarget =
	process.env.SVELTEKIT_ADAPTER ??
	(process.env.CF_PAGES ? 'cloudflare' : 'node');

const kitAdapter = adapterTarget === 'cloudflare' ? cloudflare() : node();

const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex()],
	onwarn: (warning, handler) => {
		// 鍏抽棴涓?label 鍏宠仈鍜岃嚜闂悎 div 鐩稿叧鐨勬棤闅滅鍛婅锛屼究浜庡悗缁璇█涓庣粨鏋勯噸鏋?		if (warning.code === 'a11y-label-has-associated-control') return;
		if (warning.code === 'element_invalid_self_closing_tag') return;
		handler(warning);
	},
	kit: {
		adapter: kitAdapter
	},
	extensions: ['.svelte', '.svx']
};

export default config;
