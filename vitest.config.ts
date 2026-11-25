import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      // List every source 
      // file, including ones no test imports (they show 0%),
      // so the report reflects real coverage.
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        // Bootstrap/wiring and the standalone seed script are covered by e2e,
        // not unit tests.
        'src/main.ts',
        'src/**/*.module.ts',
        'src/database/seeds/**',
        // TypeORM CLI wiring and generated migrations, exercised by
        // `npm run migration:run`, not unit tests.
        'src/database/data-source.ts',
        'src/database/migrations/**',
      ],
      // `npm run test:cov` fails if coverage drops below these.
      // Branches can't reach 100%: the test transformer emits
      // `typeof X === "undefined" ? Object : X` for decorator metadata,
      // and the `Object` side never runs.
      thresholds: {
        statements: 100,
        functions: 100,
        lines: 100,
        branches: 85,
      },
    },
  },
});
