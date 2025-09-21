import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    rules: {
      // Enforce coding standards from docs/architecture/coding-standards.md
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off", // Too restrictive for React components
      "@typescript-eslint/explicit-module-boundary-types": "off", // Too restrictive for React components
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-const": "error",
      "@typescript-eslint/no-var-requires": "error",

      // React specific rules
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/react-in-jsx-scope": "off", // Not needed in Next.js
      "react/display-name": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Code organization rules
      "import/order": ["error", {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
          "type"
        ],
        "newlines-between": "never",
        "alphabetize": {
          "order": "asc",
          "caseInsensitive": true
        }
      }],

      // General code quality
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "prefer-const": "error",
      "no-var": "error",

      // Naming conventions
      "camelcase": ["error", { "properties": "never", "ignoreDestructuring": true }],
    }
  },
  {
    files: ["**/__tests__/**/*", "**/*.test.*", "**/*.spec.*"],
    rules: {
      // Allow console.log in tests
      "no-console": "off",
      // Allow any in tests for mocking
      "@typescript-eslint/no-explicit-any": "off",
    }
  }
];

export default eslintConfig;
