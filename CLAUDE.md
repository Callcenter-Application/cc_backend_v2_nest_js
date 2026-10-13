# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NestJS backend ("CallBook") for a callcenter application, using TypeORM against PostgreSQL. Pure ESM (`"type": "module"` in package.json) — all relative imports between TypeScript files must use explicit `.js` extensions (e.g. `import { UserService } from './user.service.js'`), even though the source files are `.ts`.


## Commands

```bash
npm run start:dev       # run with watch mode (primary dev loop)
npm run start           # run once
npm run start:debug     # run with --inspect and watch mode
npm run build           # nest build
npm run lint            # oxlint --type-aware src/ test/
npm run format          # prettier --write src/**/*.ts test/**/*.ts

npm run test            # vitest run — unit/spec tests (**/*.spec.ts)
npm run test:watch      # vitest watch mode
npm run test:cov        # vitest run with coverage
npm run test:e2e        # vitest run --config ./vitest.config.e2e.ts (**/*.e2e-spec.ts)
```

- To run a single test file: `npx vitest run path/to/file.spec.ts`. To run a single test by name: `npx vitest run -t "test name"`.

- Linting (`oxlint`) is type-aware and configured in `.oxlintrc.json`; `typescript/no-floating-promises` is an error — always `await` or explicitly handle promises.

- Local Postgres + app via Docker: `docker compose up` (reads `.env`; see `.env.example` for required vars — `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `PORT`, `CONTAINER_NAME`, `POSTGRES_NAME`).

- avoid any CLAUDE contributor in github commits.

## Architecture

- **Module structure**: standard Nest feature modules under `src/<feature>/` (currently `src/user/`), each with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/`, and (for user) `enums/`. New features should follow this same layout.
- **Config**: `src/config/configuration.ts` centralizes env-based config (port, database connection) and is loaded via `ConfigModule.forRoot({ isGlobal: true, load: [configuration] })` in `src/app.module.ts`. Read config elsewhere through the injected `ConfigService` (`config.get<T>('database.host')`), not `process.env` directly.
- **Database**: `TypeOrmModule.forRootAsync` in `src/app.module.ts` wires Postgres using `ConfigService`. `autoLoadEntities: true` and `synchronize: true` are both on — entities registered via `TypeOrmModule.forFeature([...])` in each feature module are auto-discovered and the schema auto-syncs (fine for this stage of the project, but `synchronize: true` is unsafe once real data matters).
- **`UserService` is currently backed by an in-memory array (`fakeDB`)**, not the TypeORM repository, despite `User` being a registered TypeORM entity. When extending user functionality, decide whether to continue the in-memory approach or wire in the actual `Repository<User>` (inject via `@InjectRepository(User)`) — don't assume persistence is wired up just because the entity/module look TypeORM-ready.
- **API docs**: Swagger is set up in `src/main.ts` via `@nestjs/swagger` and served at `/docs`. DTOs and entities use `@ApiProperty()` decorators — keep these in sync when changing fields.
- **Observability**: `@nestjs/observe` is wired through `createObserveModule()` in `src/app.module.ts` (exported as `ObserveModule`/`ObserveInstrument`) and passed into `NestFactory.create` in `src/main.ts`.
- **Testing**: Vitest (not Jest) is used for both unit and e2e tests, with separate configs (`vitest.config.ts` for `*.spec.ts`, `vitest.config.e2e.ts` for `*.e2e-spec.ts`). Both use `vite-tsconfig-paths` to resolve tsconfig path aliases.
