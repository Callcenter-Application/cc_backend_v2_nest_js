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

npm run seed:admin        # seed the first Administrator user (local, via --env-file=.env)
npm run seed:admin:docker # same seed, against the built dist/ output (used by entrypoint.sh)
```

- To run a single test file: `npx vitest run path/to/file.spec.ts`. To run a single test by name: `npx vitest run -t "test name"`.

- Linting (`oxlint`) is type-aware and configured in `.oxlintrc.json`; `typescript/no-floating-promises` is an error — always `await` or explicitly handle promises.

- Local Postgres + app via Docker: `docker compose up` (reads `.env`; see `.env.example` for required vars — `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `PORT`, `CONTAINER_NAME`, `POSTGRES_NAME`, plus `JWT_SECRET`, `JWT_EXPIRES_IN`, and `SEED_ADMIN_*`). The container's `entrypoint.sh` starts the app and then runs `seed:admin:docker`, which retries until TypeORM's `synchronize` has created the schema before inserting the first Administrator.

- avoid any CLAUDE contributor in github commits.

## Architecture

- **Module structure**: standard Nest feature modules under `src/<feature>/` (`src/user/`, `src/auth/`), each with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and (where relevant) `entities/`, `enums/`, `guards/`, `strategies/`, `decorators/`. New features should follow this same layout.
- **Config**: `src/config/configuration.ts` centralizes env-based config (port, database connection, JWT secret/expiry) and is loaded via `ConfigModule.forRoot({ isGlobal: true, load: [configuration] })` in `src/app.module.ts`. Read config elsewhere through the injected `ConfigService` (`config.get<T>('database.host')` / `config.getOrThrow<T>('jwt.secret')`), not `process.env` directly — `getOrThrow` is used for JWT config since the app can't run meaningfully without it.
- **Database**: `TypeOrmModule.forRootAsync` in `src/app.module.ts` wires Postgres using `ConfigService`. `autoLoadEntities: true` and `synchronize: true` are both on — entities registered via `TypeOrmModule.forFeature([...])` in each feature module are auto-discovered and the schema auto-syncs (fine for this stage of the project, but `synchronize: true` is unsafe once real data matters).
- **`UserService` is backed by the real TypeORM `Repository<User>`** (injected via `@InjectRepository(User)`), not an in-memory store. Deletion is soft: `remove()` sets `isActive: false` rather than deleting the row, and `findAll`/`findOne` only return users where `isActive: true` — a user is never truly gone from the table, just filtered out. Passwords are hashed with `bcryptjs` (`PASSWORD_SALT_ROUNDS = 10`) on both create and on update-with-new-password.
- **Auth**: `src/auth/` implements JWT login via `@nestjs/passport` + `passport-jwt`. `POST /auth/login` (`AuthService.login`) verifies email/password against the `User` repository and signs a JWT (`{ sub, email, role }` payload). Route protection is two guards stacked together: `JwtAuthGuard` (validates the bearer token via `JwtStrategy`) and `RolesGuard` (reads required roles set by the `@Roles(...roleEnum[])` decorator via `Reflector`, and checks `request.user.role`). See `UserController`'s `create`/`remove` endpoints for the pattern: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(roleEnum.ADMINISTRATOR)`. Endpoints with no `@UseGuards` are unauthenticated.
- **Roles**: `roleEnum` (`src/user/enums/roleEnum.ts`) is a numeric enum — `ADMINISTRATOR`, `SUPERVISOR`, `OPERATOR` (in that declaration order, so the underlying values are `0`, `1`, `2`). TypeORM persists it as a Postgres enum type named `<table>_<column>_enum` (e.g. `user_role_enum`), storing the numeric value as a string — see `src/database/seeds/admin.seed.ts` for an example of querying/inserting against it directly with raw SQL.
- **Seeding**: `src/database/seeds/admin.seed.ts` creates the first Administrator user if none exists (checked by role, not a fixed email), using `SEED_ADMIN_*` env vars for credentials (defaults otherwise). It deliberately avoids importing sibling `.ts` files (keeps `roleEnum.ADMINISTRATOR` as a literal `'0'`) so it can run standalone via `node --experimental-transform-types`.
- **API docs**: Swagger is set up in `src/main.ts` via `@nestjs/swagger` and served at `/docs`. DTOs and entities use `@ApiProperty()` decorators — keep these in sync when changing fields.
- **Observability**: `@nestjs/observe` is wired through `createObserveModule()` in `src/app.module.ts` (exported as `ObserveModule`/`ObserveInstrument`) and passed into `NestFactory.create` in `src/main.ts`.
- **Testing**: Vitest (not Jest) is used for both unit and e2e tests, with separate configs (`vitest.config.ts` for `*.spec.ts`, `vitest.config.e2e.ts` for `*.e2e-spec.ts`). Both use `vite-tsconfig-paths` to resolve tsconfig path aliases.
