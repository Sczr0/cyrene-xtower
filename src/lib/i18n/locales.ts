import type { GameKey, PoolKey } from '$lib/gacha/core/types';

export type LocaleKey = 'en' | 'zh-cn' | 'zh-tw';

type PoolOption = { value: PoolKey; label: string };

type DistributionCard = { title: string; description: string };

export type LocaleText = {
	site: {
		title: string;
		description: string;
		keywords: string;
		ogLocale: string;
		currency: string;
		author: string;
	};
	hero: {
		gameLine: string;
		title: string;
		description: string;
	};
	form: {
		heading: string;
		subheading: string;
		basicsTitle: string;
		gameLabel: string;
		gameOptions: Record<GameKey, string>;
		poolLabel: string;
		poolOptions: Record<GameKey, PoolOption[]>;
		targetLabel: string;
		budgetLabel: string;
		stateTitle: string;
		pityLabel: string;
		guaranteeLabel: string;
		guaranteeOptions: { value: boolean; label: string }[];
		mingguangLabel: string;
		fateLabel: string;
		advancedTitle: string;
		up4c6Label: string;
		up4c6Unavailable: string;
		actions: {
			expectationLabel: string;
			expectationLoading: string;
			distributionLabel: string;
			distributionLoading: string;
			helper: string;
		};
		errors: {
			invalidTarget: string;
			invalidBudget: string;
			unknown: string;
		};
	};
	buckets: {
		pullLabels: { p25: string; p50: string; p75: string; p95: string };
		zoneLabels: { p25: string; p50: string; p75: string; p95: string };
	};
	results: {
		heading: string;
		summary: string;
		modeLabel: string;
		modeExpectation: string;
		modeDistribution: string;
		reset: string;
		loadingDistribution: string;
		loadingExpectation: string;
		loadingNote: string;
		returnsDistributionTitle: string;
		meanCard: { title: string; subtitle: string };
		successCard: { title: string; description: string; placeholder: string };
		returnsCard: { title: string; description: string; placeholder: string };
		pullDistribution: {
			p25: DistributionCard;
			p50: DistributionCard;
			p75: DistributionCard;
			p95: DistributionCard;
		};
		returnDistribution: {
			p25: DistributionCard;
			p50: DistributionCard;
			p75: DistributionCard;
			p95: DistributionCard;
		};
		empty: { title: string; description: string };
	};
	docs: {
		usageTitle: string;
		usage: string[];
		modelTitle: string;
		model: string[];
		noticeTitle: string;
		notice: string[];
	};
	apiErrors: {
		emptyBody: string;
		invalidGame: string;
		invalidPool: string;
		invalidTarget: string;
		invalidBudget: string;
		unknown: string;
	};
	engineErrors: {
		unsupportedCombination: (key: string) => string;
		matrixNotSquare: string;
		matrixVectorMismatch: string;
		matrixSingular: string;
	};
};

const zhCN: LocaleText = {
	site: {
		title: '米游抽卡期望与分布计算器',
		description:
			'提供原神、崩坏：星穹铁道与绝区零的抽卡期望值与分布计算。支持自定义保底、命定值与蒙特卡洛模拟。',
		keywords:
			'抽卡,原神,星穹铁道,绝区零,抽卡模拟,保底,命定值,概率计算,期望,蒙特卡洛,zzz,genshin',
		ogLocale: 'zh_CN',
		currency: 'CNY',
		author: 'Cyrene'
	},
	hero: {
		gameLine: '原神 / 崩坏：星穹铁道 / 绝区零',
		title: '多游戏抽卡期望 & 概率计算器',
		description: '输入当前垫抽、保底状态与目标数量，一键获得期望抽数、预算达成概率和欧非分布区间。'
	},
	form: {
		heading: '抽卡参数',
		subheading: '按顺序选择游戏与卡池，并填写目标与当前状态',
		basicsTitle: '基础配置',
		gameLabel: '游戏',
		gameOptions: {
			genshin: '原神',
			hsr: '崩坏：星穹铁道',
			zzz: '绝区零'
		},
		poolLabel: '卡池',
		poolOptions: {
			genshin: [
				{ value: 'character', label: '角色池' },
				{ value: 'weapon', label: '武器池' }
			],
			hsr: [
				{ value: 'character', label: '角色池' },
				{ value: 'lightcone', label: '光锥池' }
			],
			zzz: [
				{ value: 'character', label: '角色池' },
				{ value: 'weapon', label: '音擎池' }
			]
		},
		targetLabel: '目标数量',
		budgetLabel: '预算抽数（可选）',
		stateTitle: '当前状态',
		pityLabel: '当前垫抽',
		guaranteeLabel: '保底状态',
		guaranteeOptions: [
			{ value: false, label: '小保底（上次抽到 UP）' },
			{ value: true, label: '大保底（上次抽到常驻）' }
		],
		mingguangLabel: '明光计数（连续吃大保底多少次）（原神角色池）',
		fateLabel: '命定值（原神武器池）',
		advancedTitle: '高级选项',
		up4c6Label: 'UP 四星已满命（角色池专用）',
		up4c6Unavailable: '当前卡池不支持 UP 四星满命配置，此选项自动忽略。',
		actions: {
			expectationLabel: '计算期望抽数',
			expectationLoading: '计算中...',
			distributionLabel: '模拟分布与概率',
			distributionLoading: '模拟运行中...',
			helper: '期望模式计算更快，分布模式更适合评估预算与风险敞口。'
		},
		errors: {
			invalidTarget: '目标数量必须为正整数',
			invalidBudget: '预算必须为正整数或留空',
			unknown: '未知错误，请稍后重试'
		}
	},
	buckets: {
		pullLabels: {
			p25: '欧皇',
			p50: '正常',
			p75: '偏非',
			p95: '非酋'
		},
		zoneLabels: {
			p25: '欧皇区',
			p50: '正常区',
			p75: '偏非区',
			p95: '非酋区'
		}
	},
	results: {
		heading: '结果概览',
		summary: '基于当前配置的抽卡期望与分布统计',
		modeLabel: '当前模式：',
		modeExpectation: '数学期望',
		modeDistribution: '模拟分布',
		reset: '清空结果',
		loadingDistribution: '正在运行模拟，耗时取决于循环次数，请稍候。',
		loadingExpectation: '正在计算数学期望，请稍候。',
		loadingNote: '大规模模拟会持续几秒，重算期间按钮已锁定，避免重复点击。',
		returnsDistributionTitle: '副产物返还分布（星辉 / 星芒 / 信号余波）',
		meanCard: {
			title: '期望抽数（平均值）',
			subtitle: '约折算原石 / 星琼 / 菲林：'
		},
		successCard: {
			title: '预算达成概率',
			description: '在预算抽数内完成目标的大致概率',
			placeholder: '仅在模拟模式且填写预算时展示'
		},
		returnsCard: {
			title: '副产物返还（平均值）',
			description: '包含星辉 / 星芒 / 信号余波等返还资源',
			placeholder: '部分卡池或数学模式下不提供返还统计'
		},
		pullDistribution: {
			p25: { title: '25% 欧皇线（抽数）', description: '约 25% 概率在该抽数内毕业' },
			p50: { title: '50% 中位线（抽数）', description: '一半玩家在该抽数前完成' },
			p75: { title: '75% 偏非线（抽数）', description: '超过该抽数属于偏非情况' },
			p95: { title: '95% 天选非酋线（抽数）', description: '极端情况下可能达到的抽数上界' }
		},
		returnDistribution: {
			p25: { title: '25% 欧皇线（返还）', description: '约 25% 概率返还不低于该数值' },
			p50: { title: '50% 中位线（返还）', description: '一半模拟中返还不少于该数值' },
			p75: { title: '75% 偏非线（返还）', description: '低于该返还量属于偏非情况' },
			p95: { title: '95% 极端线（返还）', description: '极端欧皇情况下可能获得的返还上界' }
		},
		empty: {
			title: '尚未计算结果',
			description: '在左侧配置参数后，点击「计算期望抽数」或「模拟分布与概率」开始计算。'
		}
	},
	docs: {
		usageTitle: '使用说明',
		usage: [
			'选择游戏与卡池，并填写目前垫抽与保底状态。',
			'「期望抽数」使用数学模型进行快速估计。',
			'「模拟分布」使用蒙特卡洛模拟，给出概率区间与预算达成概率。'
		],
		modelTitle: '模型说明',
		model: ['角色池下的蒙特卡洛模拟次数更高，因此计算时间略长。'],
		noticeTitle: '注意事项',
		notice: ['所有结果仅供参考，不代表官方概率与实际抽卡结果。']
	},
	apiErrors: {
		emptyBody: '请求体为空或格式错误',
		invalidGame: '游戏类型不合法',
		invalidPool: '卡池类型不合法或与游戏不匹配',
		invalidTarget: '目标数量必须为正整数',
		invalidBudget: '预算必须为正整数或留空',
		unknown: '未知错误，请稍后重试'
	},
	engineErrors: {
		unsupportedCombination: (key: string) => `不支持的游戏与卡池组合: ${key}`,
		matrixNotSquare: 'solveLinearSystem 仅支持方阵',
		matrixVectorMismatch: '向量 b 的长度必须与矩阵 A 维度一致',
		matrixSingular: '线性方程组奇异或近似奇异，无法求解'
	}
};

const en: LocaleText = {
	site: {
		title: 'Gacha Expectation & Distribution Calculator',
		description:
			'Provides gacha expectation and distribution calculations for Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero. Supports custom pity, fate points, and Monte Carlo simulations.',
		keywords:
			'gacha,genshin,star rail,zzz,gacha simulation,pity,fate points,probability,expectation,monte carlo',
		ogLocale: 'en_US',
		currency: 'USD',
		author: 'Cyrene'
	},
	hero: {
		gameLine: 'Genshin Impact / Honkai: Star Rail / Zenless Zone Zero',
		title: 'Multi-Game Gacha Expectation & Probability Calculator',
		description:
			'Enter your current pity, guarantee status, and target count to instantly get expected pulls, budget success rates, and luck distribution intervals.'
	},
	form: {
		heading: 'Gacha Parameters',
		subheading: 'Select game and pool, then fill in target and current state',
		basicsTitle: 'Basic Configuration',
		gameLabel: 'Game',
		gameOptions: {
			genshin: 'Genshin Impact',
			hsr: 'Honkai: Star Rail',
			zzz: 'Zenless Zone Zero'
		},
		poolLabel: 'Pool',
		poolOptions: {
			genshin: [
				{ value: 'character', label: 'Character Event' },
				{ value: 'weapon', label: 'Weapon Event' }
			],
			hsr: [
				{ value: 'character', label: 'Character Event' },
				{ value: 'lightcone', label: 'Light Cone Event' }
			],
			zzz: [
				{ value: 'character', label: 'Agent Search' },
				{ value: 'weapon', label: 'W-Engine Search' }
			]
		},
		targetLabel: 'Target Count',
		budgetLabel: 'Budget Pulls (Optional)',
		stateTitle: 'Current State',
		pityLabel: 'Current Pity',
		guaranteeLabel: 'Guarantee Status',
		guaranteeOptions: [
			{ value: false, label: '50/50 (Last pull was UP)' },
			{ value: true, label: 'Guaranteed (Last pull was Standard)' }
		],
		mingguangLabel: 'Capturing Radiance Counter (Genshin Character)',
		fateLabel: 'Fate Points (Genshin Weapon)',
		advancedTitle: 'Advanced Options',
		up4c6Label: 'UP 4-Star C6 (Character Pool Only)',
		up4c6Unavailable: 'Current pool does not support UP 4-Star C6 config, option ignored.',
		actions: {
			expectationLabel: 'Calculate Expectation',
			expectationLoading: 'Calculating...',
			distributionLabel: 'Simulate Distribution',
			distributionLoading: 'Simulating...',
			helper: 'Expectation mode is faster; Distribution mode is better for assessing budget and risk.'
		},
		errors: {
			invalidTarget: 'Target count must be a positive integer',
			invalidBudget: 'Budget must be a positive integer or empty',
			unknown: 'Unknown error, please try again later'
		}
	},
	buckets: {
		pullLabels: {
			p25: 'Lucky',
			p50: 'Average',
			p75: 'Unlucky',
			p95: 'Very Unlucky'
		},
		zoneLabels: {
			p25: 'Lucky Zone',
			p50: 'Average Zone',
			p75: 'Unlucky Zone',
			p95: 'Very Unlucky Zone'
		}
	},
	results: {
		heading: 'Results Overview',
		summary: 'Gacha expectation and distribution statistics based on current configuration',
		modeLabel: 'Current Mode: ',
		modeExpectation: 'Mathematical Expectation',
		modeDistribution: 'Simulation Distribution',
		reset: 'Reset Results',
		loadingDistribution: 'Running simulation, duration depends on iteration count, please wait.',
		loadingExpectation: 'Calculating mathematical expectation, please wait.',
		loadingNote:
			'Large-scale simulations may take a few seconds. Buttons are locked during calculation to prevent duplicate clicks.',
		returnsDistributionTitle: 'Return Distribution (Starglitter / Starlight / Residual Signal)',
		meanCard: {
			title: 'Expected Pulls (Average)',
			subtitle: 'Approx. Primogems / Stellar Jades / Polychromes: '
		},
		successCard: {
			title: 'Budget Success Rate',
			description: 'Approximate probability of achieving the target within the budget',
			placeholder: 'Displayed only in simulation mode with budget filled'
		},
		returnsCard: {
			title: 'Returns (Average)',
			description: 'Includes Starglitter / Starlight / Residual Signal returns',
			placeholder: 'Returns statistics not available in some pools or math mode'
		},
		pullDistribution: {
			p25: {
				title: '25% Lucky Line (Pulls)',
				description: 'Approx. 25% chance to complete within this many pulls'
			},
			p50: {
				title: '50% Median Line (Pulls)',
				description: 'Half of players complete before this many pulls'
			},
			p75: {
				title: '75% Unlucky Line (Pulls)',
				description: 'Exceeding this many pulls is considered unlucky'
			},
			p95: {
				title: '95% Very Unlucky Line (Pulls)',
				description: 'Upper bound of pulls in extreme cases'
			}
		},
		returnDistribution: {
			p25: {
				title: '25% Lucky Line (Returns)',
				description: 'Approx. 25% chance returns are not lower than this value'
			},
			p50: {
				title: '50% Median Line (Returns)',
				description: 'Half of simulations return no less than this value'
			},
			p75: {
				title: '75% Unlucky Line (Returns)',
				description: 'Returns lower than this are considered unlucky'
			},
			p95: {
				title: '95% Extreme Line (Returns)',
				description: 'Upper bound of returns in extreme lucky cases'
			}
		},
		empty: {
			title: 'No Results Yet',
			description:
				'Configure parameters on the left, then click "Calculate Expectation" or "Simulate Distribution" to start.'
		}
	},
	docs: {
		usageTitle: 'Usage Instructions',
		usage: [
			'Select game and pool, and fill in current pity and guarantee status.',
			'"Expected Pulls" uses a mathematical model for quick estimation.',
			'"Simulate Distribution" uses Monte Carlo simulation to provide probability intervals and budget success rates.'
		],
		modelTitle: 'Model Explanation',
		model: [
			'Monte Carlo simulations for character pools have higher iteration counts, so calculation time is slightly longer.'
		],
		noticeTitle: 'Notices',
		notice: [
			'All results are for reference only and do not represent official probabilities or actual gacha results.'
		]
	},
	apiErrors: {
		emptyBody: 'Request body is empty or malformed',
		invalidGame: 'Invalid game type',
		invalidPool: 'Invalid pool type or mismatch with game',
		invalidTarget: 'Target count must be a positive integer',
		invalidBudget: 'Budget must be a positive integer or empty',
		unknown: 'Unknown error, please try again later'
	},
	engineErrors: {
		unsupportedCombination: (key: string) => `Unsupported game and pool combination: ${key}`,
		matrixNotSquare: 'solveLinearSystem only supports square matrices',
		matrixVectorMismatch: 'Length of vector b must match dimension of matrix A',
		matrixSingular: 'Linear system is singular or nearly singular, cannot solve'
	}
};

const fallback = zhCN;

export const locales: Record<LocaleKey, LocaleText> = {
	'zh-cn': zhCN,
	en: en,
	'zh-tw': fallback
};

export const defaultLocale: LocaleKey = 'zh-cn';

export const getLocaleText = (locale?: LocaleKey | null): LocaleText => {
	return locales[locale ?? defaultLocale] ?? locales[defaultLocale];
};
