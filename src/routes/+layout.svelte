<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// SEO 相关基础信息（站点标题、描述与结构化数据）
	const siteUrl = 'https://cyrene.xtower.site';
	const siteTitle = '米游抽卡期望与分布计算器';
	const siteDescription =
		'提供原神、崩坏：星穹铁道与绝区零的抽卡期望值与分布可视化计算。';
	const siteKeywords =
		'抽卡,原神,星穹铁道,绝区零,抽卡模拟,保底,命定值,概率计算,期望,蒙特卡洛';
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: siteTitle,
		description: siteDescription,
		url: siteUrl,
		inLanguage: 'zh-CN',
		applicationCategory: 'GameApplication',
		operatingSystem: 'All'
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="canonical" href={siteUrl} />
	<title>{siteTitle}</title>
	<meta name="description" content={siteDescription} />
	<meta name="keywords" content={siteKeywords} />
	<meta name="robots" content="index,follow" />
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={siteUrl} />
	<meta property="og:locale" content="zh_CN" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
	<script type="application/ld+json">
		{JSON.stringify(jsonLd)}
	</script>
</svelte:head>

{@render children()}
