import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Valid data-fetch / hydration patterns across shop pages; refactor separately.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      // React Compiler may conservatively skip a component when it cannot prove
      // an existing useMemo dependency set. Keep these findings visible in CI,
      // but do not fail correctness/regression verification merely because an
      // optimization was skipped. Runtime semantics are still checked by types,
      // tests and the production build in the same workflow.
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
