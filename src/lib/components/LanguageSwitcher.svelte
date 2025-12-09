<script lang="ts">
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { page } from '$app/stores';
	import type { LocaleKey } from '$lib/i18n/locales';

	const locales: { key: LocaleKey; label: string }[] = [
		{ key: 'zh-cn', label: '简体中文' },
		{ key: 'zh-tw', label: '繁體中文' },
		{ key: 'en', label: 'English' }
	];

	const currentLocale = getLocale() as LocaleKey;
	let isOpen = false;
	let timeoutId: ReturnType<typeof setTimeout>;

	function switchLocale(newLocale: LocaleKey) {
		if (newLocale === currentLocale) return;
		
		// Set the locale cookie/storage
		setLocale(newLocale);
		
		// Get the current path and localize it for the new locale
		const path = $page.url.pathname;
		const search = $page.url.search;
		const hash = $page.url.hash;
		
		// localizeHref handles the path prefixing logic
		const newUrl = localizeHref(path + search + hash, { locale: newLocale });
		
		// Navigate to the new URL
		window.location.href = newUrl;
	}

	function handleMouseEnter() {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		isOpen = true;
	}

	function handleMouseLeave() {
		timeoutId = setTimeout(() => {
			isOpen = false;
		}, 150); // 150ms 延迟，防止菜单快速消失
	}
</script>

<div class="relative inline-block text-left" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded={isOpen} on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave}>
	<button
		type="button"
		class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
			fill="currentColor"
			class="h-4 w-4 text-slate-400"
		>
			<path
				fill-rule="evenodd"
				d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
				clip-rule="evenodd"
			/>
		</svg>
		<span>{locales.find((l) => l.key === currentLocale)?.label ?? 'Language'}</span>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
			fill="currentColor"
			class="h-4 w-4 text-slate-400 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
		>
			<path
				fill-rule="evenodd"
				d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>

	{#if isOpen}
		<div
			class="absolute right-0 z-10 mt-1 w-32 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
		>
			{#each locales as locale}
				<button
					type="button"
					class="block w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 {currentLocale ===
					locale.key
						? 'bg-slate-50 font-medium text-blue-600'
						: ''}"
					on:click={() => switchLocale(locale.key)}
				>
					{locale.label}
				</button>
			{/each}
		</div>
	{/if}
</div>