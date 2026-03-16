import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
	},
	resolve: {
		alias: {
			obsidian: './tests/__mocks__/obsidian.ts',
		},
	},
});
