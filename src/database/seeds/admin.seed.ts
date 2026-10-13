import { Client } from 'pg';
import { hash } from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 10;

// Mirrors roleEnum.ADMINISTRATOR (src/user/enums/roleEnum.ts). Kept as a
// literal, rather than imported, so this script can run standalone via
// `node --experimental-transform-types` without resolving sibling .ts files.
const ADMINISTRATOR_ROLE = '0';

// When run alongside app startup (see entrypoint.sh), the "user" table may
// not exist yet until TypeORM's `synchronize` finishes — retry the initial
// read until the schema is ready instead of failing the container.
const SCHEMA_READY_MAX_ATTEMPTS = 15;
const SCHEMA_READY_RETRY_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const client = new Client({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '', 10) || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@callbook.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Test12345@';
  const firstName = process.env.SEED_ADMIN_FIRSTNAME ?? 'Admin';
  const lastName = process.env.SEED_ADMIN_LASTNAME ?? 'User';

  await client.connect();
  try {
    // "user_role_enum" is the Postgres enum type TypeORM synchronize generated
    // from the User.role column (`<table>_<column>_enum`); it stores the
    // numeric enum values as strings (e.g. '0' for ADMINISTRATOR).
    let rows;
    for (let attempt = 1; ; attempt++) {
      try {
        ({ rows } = await client.query(
          'SELECT id FROM "user" WHERE role = $1::user_role_enum LIMIT 1',
          [ADMINISTRATOR_ROLE],
        ));
        break;
      } catch (error) {
        if (attempt >= SCHEMA_READY_MAX_ATTEMPTS) {
          throw error;
        }
        console.log(
          `Schema not ready yet, retrying (${attempt}/${SCHEMA_READY_MAX_ATTEMPTS})...`,
        );
        await sleep(SCHEMA_READY_RETRY_DELAY_MS);
      }
    }

    if (rows.length > 0) {
      console.log('An Administrator user already exists, skipping seed.');
      return;
    }

    const hashedPassword = await hash(password, PASSWORD_SALT_ROUNDS);
    await client.query(
      `INSERT INTO "user" ("firstName", "lastName", email, password, role, "isActive")
       VALUES ($1, $2, $3, $4, $5::user_role_enum, true)`,
      [firstName, lastName, email, hashedPassword, ADMINISTRATOR_ROLE],
    );

    console.log(`Seeded Administrator user: ${email}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log(`Default password used (set SEED_ADMIN_PASSWORD to override): ${password}`);
    }
  } finally {
    await client.end();
  }
}

await run();
