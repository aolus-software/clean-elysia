// @ts-check
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default tseslint.config(
	{
		ignores: [
			"eslint.config.mjs",
			"dist/**/*",
			".agents/**/*",
			".claude/**/*",
			"**/*.interface.ts",
			"**/interface/**/*",
			"**/interfaces/**/*",
			"/packages/db/clickhouse/repositories/interfaces/*.ts",
			"ecosystem.config.cjs",
		],
	},

	// Base ESLint recommended
	eslint.configs.recommended,

	// TypeScript recommended (type-checked)
	...tseslint.configs.recommendedTypeChecked,

	// Prettier
	eslintPluginPrettierRecommended,

	{
		plugins: {
			"simple-import-sort": simpleImportSort,
			import: importPlugin,
		},

		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
				Bun: "readonly",
			},
			ecmaVersion: 2022,
			sourceType: "module",
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},

		rules: {
			//
			// ---- TypeScript Rules ----
			//
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-unsafe-argument": "warn",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unsafe-return": "warn",

			//
			// ---- Formatting ----
			//
			// Disabled because Prettier handles indentation
			// indent: ["error", "tab", { SwitchCase: 1 }],
			"linebreak-style": ["error", "unix"],
			quotes: [
				"error",
				"double",
				{ avoidEscape: true, allowTemplateLiterals: true },
			],
			semi: ["error", "always"],

			//
			// ---- Import Sorting ----
			//
			"simple-import-sort/imports": "error",
			"simple-import-sort/exports": "error",
			"import/first": "error",
			"import/no-duplicates": "error",

			//
			// ---- General JS Rules ----
			//
			"no-unused-expressions": "error",
			"no-unused-vars": [
				"error",
				{
					args: "after-used",
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"no-console": "warn",
			"no-undef": "off",
			"no-redeclare": "warn",
			"no-shadow": "warn",
		},
	},
);
