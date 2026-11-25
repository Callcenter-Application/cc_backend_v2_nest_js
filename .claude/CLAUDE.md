# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CallBook api backend

### Instructions:
- Do not add yourself as colaborator or coauthor in this repo (no `Co-Authored-By` or other Claude attribution lines in commits or PRs).
- Before any general request (one that isn't limited to specific files), read the whole repo first. If I ask you to read specific files, read just those.
- After reading the repo, if anything differs from this CLAUDE.md, update it. If I asked you to read specific files, update just that part.
- After every change you make to the repo, update this CLAUDE.md so it stays in sync.

## Project

NestJS 12 backend ("CallBook", v2 of a callcenter API) using TypeORM against PostgreSQL. Pure ESM (`"type": "module"`, `module: nodenext`) — all relative imports between TypeScript files must use explicit `.js` extensions (e.g. `import { UserService } from './user.service.js'`), even though the source files are `.ts`.

## Commands

```bash
npm run start:dev       # run with watch mode against the local DB (.env.local)
npm run start:dev:supabase  # same, against Supabase (.env.supabase)
npm run start:debug     # --inspect + watch
npm run build           # nest build -> dist/
npm run lint            # oxlint --type-aware src/ test/
npm run format          # prettier --write src/**/*.ts test/**/*.ts

npm run test            # vitest run — unit tests (**/*.spec.ts)
npm run test:watch
npm run test:cov
npm run test:e2e        # vitest --config vitest.config.e2e.ts (**/*.e2e-spec.ts)

npm run seed:admin          # seed first Administrator (--env-file=${ENV_FILE:-.env.local})
npm run seed:admin:supabase # same, against Supabase
npm run seed:admin:docker   # same seed against dist/ (run by entrypoint.sh)

npm run migration:generate -- src/database/migrations/<Name>  # builds, diffs entities vs the DB in ENV_FILE
npm run migration:run       # builds, applies pending migrations (local DB)
npm run migration:run:supabase
npm run migration:revert    # / migration:revert:supabase
```

### If you are using docker compose 
- In that case you can run this

```bash
sudo docker compose --env-file .env.local --profile local up --build -d   # app + local Postgres; the image copies the code at build time, so rebuild first
sudo docker compose --env-file .env.supabase up --build -d                # app only, against Supabase
sudo docker compose exec app npm run test:cov
```

- Single test file: `npx vitest run src/user/user.service.spec.ts`. Single test by name: `npx vitest run -t "test name"`.
- Lint is type-aware (`.oxlintrc.json`); `typescript/no-floating-promises` is an error — always `await` or explicitly handle promises (`main.ts` uses top-level `await bootstrap()`).
- Docker: the `db` service is in the `local` compose profile, so it only starts with `--profile local`; `app` depends on it with `required: false`. `--env-file` drives `${...}` interpolation, and its `APP_ENV_FILE` variable picks the file passed to the containers (`env_file`). Env templates: `.env.local.example`, `.env.supabase.example` and `.env.vercel.example` (`APP_ENV_FILE`, `POSTGRES_POOL_MAX`, `POSTGRES_*`, `POSTGRES_SSL`, `DB_SYNCHRONIZE`, `PORT`, `CONTAINER_NAME`, `POSTGRES_NAME`, `JWT_*`, `SEED_ADMIN_*`). Inside Compose the app reaches the local DB via `POSTGRES_HOST=db`; when running the app on the host against the Compose DB, use `POSTGRES_HOST=localhost`. `.dockerignore` excludes every `.env*` except the templates.
- `entrypoint.sh` first runs `migration:run:docker` when `DB_SYNCHRONIZE` isn't `true` (exits on failure), then `npm run start:dev` (watch mode, not `start:prod`) in the background, then `seed:admin:docker`, which retries until the schema exists.
- Swagger UI: `http://localhost:${PORT}/docs` (bearer auth enabled). On Vercel (`VERCEL` env var set) `swaggerUiOptions()` (`src/swagger/swagger-ui-options.ts`) loads the UI assets from cdnjs, because the function bundle doesn't include `swagger-ui-dist`'s static files.
- **Vercel**: zero-config NestJS deploy (Vercel detects `src/main.ts`, keeps `app.listen()`, runs the API as one Fluid compute function). No `vercel.json`. `.vercelignore` keeps `.env*` (except templates), `dist`, `node_modules`, `coverage` and `docs` out of CLI uploads; `.vercel/` is git-ignored. Env vars are set in the Vercel dashboard, as listed in `.env.vercel.example`: Supabase **Transaction** pooler (port `6543`), `POSTGRES_POOL_MAX=2`, `DB_SYNCHRONIZE=false`, a real `JWT_SECRET`. `entrypoint.sh` doesn't run there, so migrations and the admin seed must be run beforehand with `migration:run:supabase` / `seed:admin:supabase`. Hobby plan: non-commercial use only.

## Architecture

- **Style**: layered modular monolith (standard NestJS Controller → Service → Repository). It is a single deployable with one Postgres DB, split into feature modules wired by Nest DI. Layers: controllers + DTOs handle HTTP, guards and Swagger; services hold the business rules (hashing, soft delete, login/logout); TypeORM `Repository<T>` handles data access; `entities/` hold the tables. Cross-cutting concerns live outside the layers: guards/`@Roles` for authorization, `ConfigModule` for config, `@nestjs/observe` for observability. It is **not** hexagonal/clean architecture: services depend directly on TypeORM repositories (no repository interfaces), and entities double as Swagger models. Keep new code consistent with this unless asked to refactor.
- **Module layout**: feature modules under `src/<feature>/` (`user/`, `auth/`) with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and as needed `entities/`, `enums/`, `guards/`, `strategies/`, `decorators/`. Each module registers the entities it uses via `TypeOrmModule.forFeature([...])`. Follow this layout for new features.
- **Env loading / DB selection**: two env files, both git-ignored: `.env.local` (Docker Postgres, the default) and `.env.supabase` (Supabase Session pooler, `aws-0-us-west-2.pooler.supabase.com:5432`, user `postgres.<project-ref>`, IPv4). `ConfigModule.forRoot` uses `envFilePath: process.env.ENV_FILE ?? '.env.local'`. A missing file is skipped (e.g. in Docker, where Compose injects the vars). npm scripts pass `ENV_FILE` to `node --env-file=${ENV_FILE:-.env.local}`; the `*:supabase` scripts just set `ENV_FILE=.env.supabase`. Scripts use POSIX `VAR=value` syntax (no cross-env). Whichever file is loaded is the DB that HTTP writes hit: `start:dev:supabase` modifies the real Supabase data. A leftover root `.env` is no longer read.
- **Config**: `src/config/configuration.ts` maps env vars to a nested config object (`port`, `database.*` incl. `ssl`/`synchronize`/`poolMax`, `jwt.*`), loaded globally in `src/app.module.ts`. Read config via injected `ConfigService` (`config.get('database.host')`, `config.getOrThrow('jwt.secret')`), not `process.env`. `configuration.ts` supplies defaults (`jwt.secret` → `'dev-secret-change-me'`, `jwt.expiresIn` → `'1h'`, DB host `localhost`, port `5432`/`3000`), so `getOrThrow` on those keys never actually throws — a missing `JWT_SECRET` silently uses the dev secret. `database.ssl` (`POSTGRES_SSL`) and `database.synchronize` (`DB_SYNCHRONIZE`) are `true` only for the exact string `'true'`, so synchronize is off unless explicitly enabled. Exceptions: `main.ts` reads `process.env.PORT` directly, and the seed script reads env directly because it runs outside Nest.
- **Database**: `TypeOrmModule.forRootAsync` in `app.module.ts` with `autoLoadEntities: true` (entities registered via `TypeOrmModule.forFeature([...])` are auto-discovered). Connection options come from `buildDataSourceOptions()` in `src/database/database-options.ts`, shared with the CLI data source. It sets the pg pool size from `database.poolMax` (`POSTGRES_POOL_MAX`, default 10) via `extra.max`, turns `ssl` into `{ rejectUnauthorized: false }` (Supabase's cert is from its own CA, so no verification), and it **throws if `synchronize` is on against a Supabase host**. Before connecting, `logDatabaseTarget()` logs `Connected database: LOCAL|SUPABASE -> host:port/db (ssl, synchronize)`; for Supabase it's a warning that write requests modify the Supabase DB. Supabase is detected by host (`*.supabase.co`/`*.supabase.com`). (`mysql2` is in dependencies but unused.)
- **Schema / migrations**: local dev uses `DB_SYNCHRONIZE=true`. Supabase uses TypeORM migrations in `src/database/migrations/`. The CLI data source is `src/database/data-source.ts`, which loads `dist/**/*.entity.js` and `dist/database/migrations/*.js`. The CLI runs against **compiled** `dist/` (decorators prevent running the TS directly), so the `migration:*` scripts run `nest build` first. Generate migrations against an empty/up-to-date DB, and keep the generated constraint/index names. The initial migration (`InitialSchema`) also runs `ENABLE ROW LEVEL SECURITY` on `user` and `revoked_token`, with no policies. Supabase's Data API (PostgREST) exposes `public`, so RLS blocks the `anon`/`authenticated` roles; the app connects as the table owner and bypasses RLS. New tables need the same `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in their migration. The Data API is also meant to be disabled in the Supabase dashboard. A DB already built by `synchronize` can't take `migration:run` (the tables exist). Free-tier Supabase projects pause after ~1 week of inactivity.
- **Users** (`src/user/`): `UserService` uses the TypeORM `Repository<User>`. Deletion is soft — `remove()` sets `isActive: false`; `findAll`/`findOne` filter on `isActive: true`, and login also rejects inactive users. Passwords are hashed with `bcryptjs` (10 rounds) on create and on update when a new password is supplied. `UpdateUserDto` is `PartialType(CreateUserDto)` from `@nestjs/swagger`.
- **No request validation**: there is no global `ValidationPipe` and `class-validator`/`class-transformer` are not installed, so DTOs are only TypeScript types + `@ApiProperty` docs — request bodies are not validated at runtime. Responses also return the full `User` entity including the password hash (no `select: false` / serialization exclusion).
- **Auth** (`src/auth/`): `POST /auth/login` verifies email/password and signs a JWT with payload `{ sub, email, role }`. `JwtStrategy` maps it to `request.user = { id, email, role }` (`AuthenticatedUser`). It doesn't reload the user, so role/active changes only take effect on new tokens, but it does check (`passReqToCallback: true`) that the raw bearer token isn't revoked. `POST /auth/logout` (requires `JwtAuthGuard`) revokes the current token by storing its SHA-256 hash plus its `exp` in the `revoked_token` table (`RevokedToken` entity in `src/auth/entities/`). Expired rows are purged on each logout. Logout only revokes the token sent with the request; other tokens for the same user remain valid. Protect routes by stacking `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(roleEnum.X)` (+ `@ApiBearerAuth()` for Swagger) — see `UserController.create`/`remove`. `RolesGuard` allows the request if no `@Roles` metadata is set. Routes without `@UseGuards` are public. Every `/user` route now requires `ADMINISTRATOR`, so `POST /auth/login` is the only public endpoint (the scaffolded `AppController`/`AppService` `GET /` was removed). A fresh DB therefore needs `seed:admin` before any user can be managed.
- **Roles**: `roleEnum` (`src/user/enums/roleEnum.ts`) is a numeric enum: `ADMINISTRATOR=0`, `SUPERVISOR=1`, `OPERATOR=2` — reordering it changes stored meaning. TypeORM stores it as Postgres enum type `user_role_enum` with string values (`'0'`, `'1'`, `'2'`); raw SQL must cast, e.g. `$1::user_role_enum` (see the seed).
- **Seeding**: `src/database/seeds/admin.seed.ts` uses raw `pg` (not Nest/TypeORM) to insert the first Administrator if no user with the admin role exists, using `SEED_ADMIN_*` env vars. It intentionally imports no sibling `.ts` files (hardcodes `'0'` for ADMINISTRATOR, duplicates the `POSTGRES_SSL` handling) so it runs standalone under plain `node` (Node 26's built-in type stripping; `--experimental-transform-types` no longer exists and only erasable TS syntax is allowed); keep it that way, and update it if the `User` entity's columns or `roleEnum` change.
- **Observability**: `@nestjs/observe` via `createObserveModule()` in `app.module.ts`; `ObserveInstrument` is passed to `NestFactory.create` in `main.ts`.
- **Testing**: Vitest (not Jest), `globals: true` (use `vi.fn()`), with `vite-tsconfig-paths`. Unit tests mock repositories with `{ provide: getRepositoryToken(User), useValue: {...} }` (see `src/user/user.service.spec.ts`). Controller specs mock the service instead, and check route protection by reading `GUARDS_METADATA` / `ROLES_KEY` with a `Reflector`. `RolesGuard` and `JwtStrategy` are unit-tested by instantiating them directly with a fake `ExecutionContext` / `Request`. Specs that check password hashing use real `bcryptjs`, not mocks. Coverage (`vitest.config.ts`) includes all of `src/**/*.ts` except specs, `main.ts`, `*.module.ts`, the seed script, `src/database/data-source.ts` and `src/database/migrations/**`, so files with no tests show up as 0%. `npm run test:cov` enforces thresholds and fails below them: 100% statements/functions/lines, 85% branches. New code needs tests to keep 100% lines. Branches can't reach 100%: the test transformer emits `typeof X === "undefined" ? Object : X` for decorator metadata, and the `Object` side never runs. `update-user.dto.ts` shows 0% only because it has zero coverable statements. Don't hide these with ignore comments or coverage plugins. There are currently no e2e tests: the `test/` directory (and `test/app.e2e-spec.ts`) was deleted, so `npm run test:e2e` finds no `*.e2e-spec.ts` files, and `lint`/`format` still point at `test/`. A new e2e test that boots the full `AppModule` needs a reachable Postgres and uses `.env.local` unless `ENV_FILE` says otherwise, so keep it on the local DB.
- **docs/**: `docs/doc.md` records a troubleshooting note recommending binding the Postgres port to `127.0.0.1` in `docker-compose.yaml`; the compose file currently still publishes it on all interfaces.
