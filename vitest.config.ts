import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node is the DEFAULT environment: every `lib/**` test is pure logic and
    // must keep running without a DOM. The handful of files that render React
    // opt in per file with a `// @vitest-environment jsdom` docblock (see
    // components/organisms/BottomNav.test.tsx). The docblock is used rather
    // than `environmentMatchGlobs` because that option was removed in Vitest 4.
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
    ],
    alias: [
      // Matches the tsconfig "@/*" -> "./*" path alias. Regex-anchored so it
      // never collides with unrelated packages like "@neondatabase/serverless".
      { find: /^@\//, replacement: `${path.resolve(__dirname)}/` },
      // "server-only" unconditionally throws outside the Next.js bundler's
      // "react-server" export condition (see node_modules/server-only/index.js).
      // Vitest runs in plain Node, so alias it to a no-op stub for tests only;
      // production `next build`/`next dev` still resolve the real package and
      // enforce the real Client-Component build failure (task 12.3).
      {
        find: "server-only",
        replacement: path.resolve(__dirname, "test/stubs/server-only.ts"),
      },
    ],
    env: {
      DATABASE_URL:
        "postgres://user:pass@ep-test-00000000-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
      APP_PASSWORD: "vitest-fixture-password",
      SESSION_SECRET: "vitest-fixture-session-secret-32-bytes-min",
      TZ: "UTC",
    },
  },
});
