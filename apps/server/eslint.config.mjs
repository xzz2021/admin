// @ts-check
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["eslint.config.mjs", "src/prisma/generated/**/*"], // 忽略 prisma 生成的文件
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: "commonjs",
      parserOptions: {
        projectService: {
          allowDefaultProject: ["test/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      //   这里设置 长度要和 prettier 保持一致
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
          printWidth: 160,
          arrayElementNewline: "never",
          insertFinalNewline: true, // 允许文件末尾有多个空白行
        },
      ],
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      // '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      "@typescript-eslint/no-unused-vars": "off",

      "@typescript-eslint/no-unsafe-member-access": "off",
      // '@typescript-eslint/no-unused-imports': 'warn',
    },
  },
);
