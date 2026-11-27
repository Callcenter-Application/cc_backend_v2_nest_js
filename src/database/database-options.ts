import { Logger } from '@nestjs/common';
import type { DataSourceOptions } from 'typeorm';
import type configuration from '../config/configuration.js';

export type DatabaseConfig = ReturnType<typeof configuration>['database'];
type PostgresConnectionOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

export const isSupabaseHost = (host: string) =>
  /\.supabase\.(co|com)$/.test(host);

/**
 * Connection options shared by the Nest app (app.module.ts) and the TypeORM
 * CLI data source used for migrations (data-source.ts).
 */
export function buildDataSourceOptions(
  db: DatabaseConfig,
): PostgresConnectionOptions {
  if (db.synchronize && isSupabaseHost(db.host)) {
    throw new Error(
      'DB_SYNCHRONIZE=true is not allowed against Supabase: use migrations (npm run migration:run).',
    );
  }

  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.name,
    // Supabase's certificate is signed by its own CA, not a public one.
    ssl: db.ssl ? { rejectUnauthorized: false } : false,
    synchronize: db.synchronize,
    extra: { max: db.poolMax },
  };
}

/**
 * Logs which database this process is about to connect to, so it is obvious
 * whether HTTP requests will modify the local DB or the real Supabase one.
 */
export function logDatabaseTarget(
  db: DatabaseConfig,
  logger: Pick<Logger, 'log' | 'warn'> = new Logger('Database'),
) {
  const target = isSupabaseHost(db.host) ? 'SUPABASE' : 'LOCAL';
  const summary = `${target} -> ${db.host}:${db.port}/${db.name ?? ''} (ssl: ${db.ssl ? 'on' : 'off'}, synchronize: ${db.synchronize ? 'on' : 'off'})`;

  if (target === 'SUPABASE') {
    logger.warn(
      `Connected database: ${summary}. Write requests will modify the Supabase database.`,
    );
  } else {
    logger.log(`Connected database: ${summary}`);
  }
}
