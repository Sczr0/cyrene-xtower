import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { defaultLocale, getLocaleText } from '$lib/i18n/locales';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('should render main dashboard header', async () => {
		render(Page);

		const { hero } = getLocaleText(defaultLocale);
		const title = page.getByText(hero.title);
		await expect.element(title).toBeInTheDocument();
	});
});
