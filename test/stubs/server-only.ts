// Test-only stub for the "server-only" package.
//
// The real package unconditionally throws outside the Next.js bundler's
// "react-server" export condition, which Vitest (plain Node) does not set.
// Aliased in from vitest.config.ts for `lib/**/*.test.ts` only; production
// builds still resolve the real package via node_modules.
export {};
