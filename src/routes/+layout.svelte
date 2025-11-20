<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const siteUrl = 'https://cyrene.xtower.site';
	const siteTitle = '米游抽卡期望与分布计算器';
	const siteDescription = '提供原神、崩坏：星穹铁道与绝区零的抽卡期望值与分布计算。支持自定义保底、命定值与蒙特卡洛模拟。';
	const siteKeywords = '抽卡,原神,星穹铁道,绝区零,抽卡模拟,保底,命定值,概率计算,期望,蒙特卡洛,zzz,genshin';
    
    const ogImageUrl = `${siteUrl}/og-image.png`; 

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: siteTitle,
		description: siteDescription,
		url: siteUrl,
		inLanguage: 'zh-CN',
		applicationCategory: 'UtilitiesApplication',
		operatingSystem: 'Any',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'CNY'
        }
	};

	// 处理内容转义
	const jsonLdScriptContent = JSON.stringify(jsonLd)
        .replace(/\u003C/g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');

    // 使用 '<' + '/script>' 拼接，防止 Svelte 编译器误判为脚本结束
    const finalJsonLdTag = `<script type="application/ld+json">${jsonLdScriptContent}<` + `/script>`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={siteUrl} />
	<title>{siteTitle}</title>
	<meta name="description" content={siteDescription} />
	<meta name="keywords" content={siteKeywords} />
	<meta name="robots" content="index,follow" />
    <meta name="author" content="Cyrene" />

	<!-- Open Graph / Facebook / WeChat -->
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={siteUrl} />
	<meta property="og:locale" content="zh_CN" />
    <!-- 分享封面图 -->
    <meta property="og:image" content={ogImageUrl} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
    <meta name="twitter:image" content={ogImageUrl} />

	<!-- JSON-LD 注入 -->
    <!-- 直接渲染 script 里拼好的字符串 -->
	{@html finalJsonLdTag}
</svelte:head>

{@render children()}