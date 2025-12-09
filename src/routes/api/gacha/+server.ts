import { json, type RequestHandler } from '@sveltejs/kit';
import { runExpectation, runDistribution } from '$lib/gacha/engine';
import type { GameKey, PoolKey, Mode, InitialState, GachaArgs, PullStats } from '$lib/gacha/core/types';
import { getLocaleText } from '$lib/i18n/locales';

const localeText = getLocaleText();

const VALID_POOLS: Record<GameKey, PoolKey[]> = {
	genshin: ['character', 'weapon'],
	hsr: ['character', 'lightcone'],
	zzz: ['character', 'weapon']
};

interface GachaResponsePayload {
	mode: Mode;
	args: GachaArgs;
	pulls: PullStats;
	success_rate?: number;
	returns?: PullStats;
}

// Validate and normalize request body into standard GachaArgs
function normalizeAndValidateBody(body: unknown): GachaArgs {
	if (!body || typeof body !== 'object') {
		throw new Error(localeText.apiErrors.emptyBody);
	}

	const b = body as Partial<GachaArgs>;

	if (!b.game || !(['genshin', 'hsr', 'zzz'] as GameKey[]).includes(b.game)) {
		throw new Error(localeText.apiErrors.invalidGame);
	}

	if (!b.pool || !VALID_POOLS[b.game]?.includes(b.pool)) {
		throw new Error(localeText.apiErrors.invalidPool);
	}

	const targetCount = Number(b.targetCount ?? 1);
	if (!Number.isFinite(targetCount) || targetCount <= 0) {
		throw new Error(localeText.apiErrors.invalidTarget);
	}

	const budgetRaw = (b as { budget?: unknown }).budget;
	const budget =
		budgetRaw === null || budgetRaw === undefined || budgetRaw === ''
			? null
			: Number(budgetRaw);
	if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) {
		throw new Error(localeText.apiErrors.invalidBudget);
	}

	const initialStateRaw = (b.initialState ?? {
		pity: 0,
		isGuaranteed: false,
		mingguangCounter: 0,
		fatePoint: 0
	}) as Partial<InitialState>;

	const pity = Number(initialStateRaw.pity ?? 0);
	const mingguangCounter = Number(initialStateRaw.mingguangCounter ?? 0);
	const fatePoint = Number(initialStateRaw.fatePoint ?? 0);
	const isGuaranteedRaw = initialStateRaw.isGuaranteed;
	const isGuaranteed =
		typeof isGuaranteedRaw === 'string'
			? isGuaranteedRaw === 'true'
			: Boolean(isGuaranteedRaw);

	const initialState: InitialState = {
		pity: Number.isFinite(pity) && pity >= 0 ? pity : 0,
		isGuaranteed,
		mingguangCounter:
			Number.isFinite(mingguangCounter) && mingguangCounter >= 0
				? mingguangCounter
				: 0,
		fatePoint: Number.isFinite(fatePoint) && fatePoint >= 0 ? fatePoint : 0
	};

	const mode: Mode = b.mode === 'distribution' ? 'distribution' : 'expectation';

	return {
		game: b.game,
		pool: b.pool,
		mode,
		targetCount,
		up4C6: Boolean(b.up4C6),
		budget,
		initialState
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();
		const args = normalizeAndValidateBody(rawBody);

		let payload: GachaResponsePayload;

		if (args.mode === 'expectation') {
			const info = runExpectation(args);
			payload = {
				mode: args.mode,
				args,
				pulls: {
					mean: info.mean
				}
			};
		} else {
			const info = runDistribution(args);
			payload = {
				mode: args.mode,
				args,
				pulls: info.pulls,
				success_rate: info.successRate,
				returns: info.returns
			};
		}

		return json({ ok: true, data: payload });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : localeText.apiErrors.unknown;
		console.error('[gacha] calculation failed', error);
		return json({ ok: false, error: message }, { status: 400 });
	}
};
