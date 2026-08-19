import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"

export default defineConfig([
  globalIgnores(["dist"]),
  eslintPluginPrettierRecommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
