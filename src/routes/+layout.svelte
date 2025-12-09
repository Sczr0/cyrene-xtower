<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getLocaleText, defaultLocale, type LocaleKey } from '$lib/i18n/locales';
	import { getLocale } from '$lib/paraglide/runtime';

	let { children } = $props();

	const siteUrl = 'https://cyrene.xtower.site';
	const currentLocale = (getLocale?.() as LocaleKey) ?? defaultLocale;
	const localeText = getLocaleText(currentLocale);

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
		url: siteUrl,
		inLanguage: siteLanguage,
		applicationCategory: 'UtilitiesApplication',
		operatingSystem: 'Any',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: localeText.site.currency
		}
	};

	// Escape content before injecting JSON-LD
	const jsonLdScriptContent = JSON.stringify(jsonLd)
		.replace(/\u003C/g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026');

	// Use split string to avoid Svelte mis-detecting the closing script tag
	const finalJsonLdTag = `<script type="application/ld+json">${jsonLdScriptContent}<` + `/script>`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={siteUrl} />
	<title>{siteTitle}</title>
	<meta name="description" content={siteDescription} />
	<meta name="keywords" content={siteKeywords} />
	<meta name="robots" content="index,follow" />
    <meta name="author" content={localeText.site.author} />

	<!-- Open Graph / Facebook / WeChat -->
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={siteUrl} />
	<meta property="og:locale" content={ogLocale} />
    <!-- Social share image -->
    <meta property="og:image" content={ogImageUrl} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
    <meta name="twitter:image" content={ogImageUrl} />

	<!-- JSON-LD injection -->
    <!-- Render the prepared script content directly -->
	{@html finalJsonLdTag}
</svelte:head>

{@render children()}
