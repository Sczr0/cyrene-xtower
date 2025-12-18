<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getLocaleText, defaultLocale, type LocaleKey } from '$lib/i18n/locales';
	import { getLocale } from '$lib/paraglide/runtime';

	let { children } = $props();

	const siteUrl = 'https://cyrene.xtower.site';
	const currentLocale = (getLocale?.() as LocaleKey) ?? defaultLocale;
	const localeText = getLocaleText(currentLocale);

	const localePathMap: Record<LocaleKey, string> = {
		'zh-cn': '/',
		en: '/en/',
		'zh-tw': '/zh-tw/'
	};

	const hreflangMap: Record<LocaleKey, string> = {
		'zh-cn': 'zh-CN',
		en: 'en',
		'zh-tw': 'zh-TW'
	};

	const canonicalUrl = `${siteUrl}${localePathMap[currentLocale]}`;
	const alternateLinks = (Object.keys(localePathMap) as LocaleKey[]).map((locale) => ({
		locale,
		href: `${siteUrl}${localePathMap[locale]}`,
		hreflang: hreflangMap[locale]
	}));

	const siteTitle = localeText.site.title;
	const siteDescription = localeText.site.description;
	const siteKeywords = localeText.site.keywords;
	const ogLocale = localeText.site.ogLocale;
	const siteLanguage = ogLocale.replace('_', '-');
	const ogImageUrl = `${siteUrl}/og-image.png`;

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: siteTitle,
		description: siteDescription,
		url: canonicalUrl,
		inLanguage: siteLanguage,
		applicationCategory: 'UtilitiesApplication',
		operatingSystem: 'Any',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: localeText.site.currency
		}
	};

	// 转义后再注入 JSON-LD，避免被解析为 HTML
	const jsonLdScriptContent = JSON.stringify(jsonLd)
		.replace(/\u003C/g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026');

	// 通过拼接避免被 Svelte 误判为闭合 script
	const finalJsonLdTag =
		`<script type="application/ld+json">${jsonLdScriptContent}<` + `/script>`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={canonicalUrl} />
	{#each alternateLinks as alt}
		<link rel="alternate" hreflang={alt.hreflang} href={alt.href} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={`${siteUrl}/`} />

	<title>{siteTitle}</title>
	<meta name="description" content={siteDescription} />
	<meta name="keywords" content={siteKeywords} />
	<meta name="robots" content="index,follow" />
	<meta name="author" content={localeText.site.author} />

	<!-- Open Graph / Facebook / WeChat -->
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:locale" content={ogLocale} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
	<meta name="twitter:image" content={ogImageUrl} />

	<!-- 注入 JSON-LD -->
	{@html finalJsonLdTag}
</svelte:head>

{@render children()}
