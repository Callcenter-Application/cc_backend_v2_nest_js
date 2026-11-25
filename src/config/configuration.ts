
/**
 * Centralized application configuration, read from environment variables.
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '', 10) || 5432,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    name: process.env.POSTGRES_DB,
    // Supabase requires SSL; the local Docker Postgres does not support it.
    ssl: process.env.POSTGRES_SSL === 'true',
    // Off unless explicitly enabled, so a missing variable never lets TypeORM
    // auto-alter a real database. `.env.local` turns it on for development.
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    // Max connections per process. Keep it low on serverless (Vercel), where
    // every function instance opens its own pool against the Supabase pooler.
    poolMax: parseInt(process.env.POSTGRES_POOL_MAX ?? '', 10) || 10,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
});
