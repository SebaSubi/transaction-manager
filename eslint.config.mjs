import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Import-direction rule (design §4): imports flow inward only,
// app/ -> components/ -> lib/db/repositories/ -> lib/domain/.
// `lib/domain/` imports nothing from this repository.
//
// This is enforcement layer 2 of 3. Layer 1 is `import 'server-only'` in
// lib/db/client.ts (build-time). Layer 3 is lib/domain/architecture.test.ts,
// which runs inside `pnpm test` where a reviewer sees it fail.
const DOMAIN_FORBIDDEN = [
  "react",
  "react-dom",
  "next",
  "server-only",
];

const DOMAIN_FORBIDDEN_PATTERNS = [
  "next/*",
  "drizzle-orm",
  "drizzle-orm/*",
  "@neondatabase/*",
  "@/lib/db",
  "@/lib/db/*",
  "@/lib/db/**",
  "@/components/*",
  "@/components/**",
  "@/app/*",
  "@/app/**",
];

const UI_FORBIDDEN_PATTERNS = [
  "drizzle-orm",
  "drizzle-orm/*",
  "@neondatabase/*",
  "@/lib/db/schema",
  "@/lib/db/client",
];

const REPOSITORY_FORBIDDEN = ["react", "react-dom"];

const REPOSITORY_FORBIDDEN_PATTERNS = [
  "next/*",
  "@/components/*",
  "@/components/**",
  "@/app/*",
  "@/app/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored prototype runtime kept for reference (obs #59). Not app source
    // and never bundled; linting it reports the prototype's problems as ours.
    "docs/**",
  ]),
  {
    files: ["lib/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: DOMAIN_FORBIDDEN.map((name) => ({
            name,
            message:
              "lib/domain/ is pure: no React, no Next, no server-only, no database module.",
          })),
          patterns: [
            {
              group: DOMAIN_FORBIDDEN_PATTERNS,
              message:
                "lib/domain/ is pure: no React, no Next, no server-only, no database module, no app/ or components/ import.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: UI_FORBIDDEN_PATTERNS,
              message:
                "lib/db/repositories/ are the only Drizzle consumers. Call a repository, never the schema or client.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/db/repositories/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: REPOSITORY_FORBIDDEN.map((name) => ({
            name,
            message: "Repositories are a persistence adapter: no React, no UI import.",
          })),
          patterns: [
            {
              group: REPOSITORY_FORBIDDEN_PATTERNS,
              message: "Repositories are a persistence adapter: no React, no UI import.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
