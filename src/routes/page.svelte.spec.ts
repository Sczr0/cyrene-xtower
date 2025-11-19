import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('should render main dashboard header', async () => {
		render(Page);

		const title = page.getByText(/抽卡期望.*概率计算器/);
		await expect.element(title).toBeInTheDocument();
	});
});
