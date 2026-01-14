import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    globalIgnores(["**/node_modules", "**/dist", "**/build", "**/worker-configuration.d.ts"]),

    // Main config for src files using TS parser.
    {
        files: ["src/**/*.{js,ts}"],
        extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/recommended",
            "plugin:prettier/recommended"
        ),

        plugins: {
            "@typescript-eslint": typescriptEslint,
            prettier,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.worker,
                ...globals.node,
            },
            parser: tsParser,
            ecmaVersion: 2021,
            sourceType: "module",

            parserOptions: {
                project: "./tsconfig.json",
            },
        },

        rules: {
            "prettier/prettier": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_"
            }],
        },
    },
]);
