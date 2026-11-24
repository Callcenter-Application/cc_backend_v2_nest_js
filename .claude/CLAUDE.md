# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CallBook api backend

### Instructions:
- Do not add yourself as colaborator or coauthor in this repo (no `Co-Authored-By` or other Claude attribution lines in commits or PRs).
- Before any request, if I'm not clear about Read the whole repo, except if I ask you to read some specificts files.
- After reading the repo if there is any difference between the repo and the CLAUDE.md, you will update it, except if I ask you to read some specificts files, in that case you will update just that part in the CLAUDE.md

## Project

NestJS 12 backend ("CallBook", v2 of a callcenter API) using TypeORM against PostgreSQL. Pure ESM (`"type": "module"`, `module: nodenext`) — all relative imports between TypeScript files must use explicit `.js` extensions (e.g. `import { UserService } from './user.service.js'`), even though the source files are `.ts`.

## Commands

```bash
npm run start:dev       # run with watch mode (primary dev loop)
npm run start:debug     # --inspect + watch
npm run build           # nest build -> dist/
npm run lint            # oxlint --type-aware src/ test/
npm run format          # prettier --write src/**/*.ts test/**/*.ts

npm run test            # vitest run — unit tests (**/*.spec.ts)
npm run test:watch
npm run test:cov
npm run test:e2e        # vitest --config vitest.config.e2e.ts (**/*.e2e-spec.ts)

npm run seed:admin        # seed first Administrator (local, uses --env-file=.env)
npm run seed:admin:docker # same seed against dist/ (run by entrypoint.sh)
```

### If you are using docker compose 
- In that case you can run this

```bash
sudo docker compose up --build -d          # the image copies the code at build time, so rebuild first
sudo docker compose exec app npm run test:cov
```

- Single test file: `npx vitest run src/user/user.service.spec.ts`. Single test by name: `npx vitest run -t "test name"`.
- Lint is type-aware (`.oxlintrc.json`); `typescript/no-floating-promises` is an error — always `await` or explicitly handle promises (`main.ts` uses top-level `await bootstrap()`).
- Docker: `docker compose up --build` starts Postgres (`db`) and the app. Env vars come from `.env` (template in `.env.example`): `POSTGRES_*`, `PORT`, `CONTAINER_NAME`, `POSTGRES_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SEED_ADMIN_*`. Inside Compose the app reaches the DB via `POSTGRES_HOST=db`; when running the app on the host against the Compose DB, use `POSTGRES_HOST=localhost`.
- `entrypoint.sh` runs `npm run start:dev` (watch mode, not `start:prod`) in the background, then `seed:admin:docker`, which retries until TypeORM `synchronize` has created the schema.
- Swagger UI: `http://localhost:${PORT}/docs` (bearer auth enabled).

## Architecture

- **Style**: layered modular monolith (standard NestJS Controller → Service → Repository). It is a single deployable with one Postgres DB, split into feature modules wired by Nest DI. Layers: controllers + DTOs handle HTTP, guards and Swagger; services hold the business rules (hashing, soft delete, login/logout); TypeORM `Repository<T>` handles data access; `entities/` hold the tables. Cross-cutting concerns live outside the layers: guards/`@Roles` for authorization, `ConfigModule` for config, `@nestjs/observe` for observability. It is **not** hexagonal/clean architecture: services depend directly on TypeORM repositories (no repository interfaces), and entities double as Swagger models. Keep new code consistent with this unless asked to refactor.
- **Module layout**: feature modules under `src/<feature>/` (`user/`, `auth/`) with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and as needed `entities/`, `enums/`, `guards/`, `strategies/`, `decorators/`. Each module registers the entities it uses via `TypeOrmModule.forFeature([...])`. Follow this layout for new features.
- **Env loading**: `ConfigModule.forRoot()` has no `envFilePath`, so it loads `.env` from the current working directory (the repo root). The root `.env` uses `POSTGRES_HOST=db`, so `npm run start:dev` on the host won't reach Postgres unless that is overridden. `test/.env` exists (git-ignored) but nothing references it.
- **Config**: `src/config/configuration.ts` maps env vars to a nested config object (`port`, `database.*`, `jwt.*`), loaded globally in `src/app.module.ts`. Read config via injected `ConfigService` (`config.get('database.host')`, `config.getOrThrow('jwt.secret')`), not `process.env`. Exceptions: `main.ts` reads `process.env.PORT` directly, and the seed script reads env directly because it runs outside Nest.
- **Database**: `TypeOrmModule.forRootAsync` in `app.module.ts` with `autoLoadEntities: true` and `synchronize: true` — entities registered via `TypeOrmModule.forFeature([...])` are auto-discovered and the schema auto-syncs from entity definitions. There are no migrations. (`mysql2` is in dependencies but unused.)
- **Users** (`src/user/`): `UserService` uses the TypeORM `Repository<User>`. Deletion is soft — `remove()` sets `isActive: false`; `findAll`/`findOne` filter on `isActive: true`, and login also rejects inactive users. Passwords are hashed with `bcryptjs` (10 rounds) on create and on update when a new password is supplied. `UpdateUserDto` is `PartialType(CreateUserDto)` from `@nestjs/swagger`.
- **No request validation**: there is no global `ValidationPipe` and `class-validator`/`class-transformer` are not installed, so DTOs are only TypeScript types + `@ApiProperty` docs — request bodies are not validated at runtime. Responses also return the full `User` entity including the password hash (no `select: false` / serialization exclusion).
- **Auth** (`src/auth/`): `POST /auth/login` verifies email/password and signs a JWT with payload `{ sub, email, role }`. `JwtStrategy` maps it to `request.user = { id, email, role }` (`AuthenticatedUser`). It doesn't reload the user, so role/active changes only take effect on new tokens, but it does check (`passReqToCallback: true`) that the raw bearer token isn't revoked. `POST /auth/logout` (requires `JwtAuthGuard`) revokes the current token by storing its SHA-256 hash plus its `exp` in the `revoked_token` table (`RevokedToken` entity in `src/auth/entities/`). Expired rows are purged on each logout. Logout only revokes the token sent with the request; other tokens for the same user remain valid. Protect routes by stacking `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(roleEnum.X)` (+ `@ApiBearerAuth()` for Swagger) — see `UserController.create`/`remove`. `RolesGuard` allows the request if no `@Roles` metadata is set. Routes without `@UseGuards` are public (currently `GET /user`, `GET /user/:id`, `PATCH /user/:id`).
- **Roles**: `roleEnum` (`src/user/enums/roleEnum.ts`) is a numeric enum: `ADMINISTRATOR=0`, `SUPERVISOR=1`, `OPERATOR=2` — reordering it changes stored meaning. TypeORM stores it as Postgres enum type `user_role_enum` with string values (`'0'`, `'1'`, `'2'`); raw SQL must cast, e.g. `$1::user_role_enum` (see the seed).
- **Seeding**: `src/database/seeds/admin.seed.ts` uses raw `pg` (not Nest/TypeORM) to insert the first Administrator if no user with the admin role exists, using `SEED_ADMIN_*` env vars. It intentionally imports no sibling `.ts` files (hardcodes `'0'` for ADMINISTRATOR) so it runs standalone under `node --experimental-transform-types`; keep it that way, and update it if the `User` entity's columns or `roleEnum` change.
- **Observability**: `@nestjs/observe` via `createObserveModule()` in `app.module.ts`; `ObserveInstrument` is passed to `NestFactory.create` in `main.ts`.
- **Testing**: Vitest (not Jest), `globals: true` (use `vi.fn()`), with `vite-tsconfig-paths`. Unit tests mock repositories with `{ provide: getRepositoryToken(User), useValue: {...} }` (see `src/user/user.service.spec.ts`). Controller specs mock the service instead, and check route protection by reading `GUARDS_METADATA` / `ROLES_KEY` with a `Reflector`. `RolesGuard` and `JwtStrategy` are unit-tested by instantiating them directly with a fake `ExecutionContext` / `Request`. Specs that check password hashing use real `bcryptjs`, not mocks. Coverage (`vitest.config.ts`) includes all of `src/**/*.ts` except specs, `main.ts`, `*.module.ts` and the seed script, so files with no tests show up as 0%. `npm run test:cov` enforces thresholds and fails below them: 100% statements/functions/lines, 85% branches. New code needs tests to keep 100% lines. Branches can't reach 100%: the test transformer emits `typeof X === "undefined" ? Object : X` for decorator metadata, and the `Object` side never runs. `update-user.dto.ts` shows 0% only because it has zero coverable statements. Don't hide these with ignore comments or coverage plugins. The e2e test (`test/app.e2e-spec.ts`) boots the full `AppModule`, so it needs a reachable Postgres.
- **docs/**: `docs/doc.md` records a troubleshooting note recommending binding the Postgres port to `127.0.0.1` in `docker-compose.yaml`; the compose file currently still publishes it on all interfaces.
