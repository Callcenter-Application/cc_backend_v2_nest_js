import { join } from 'node:path';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration.js';
import { buildDataSourceOptions } from './database-options.js';

/**
 * Data source for the TypeORM CLI (migration:generate / run / revert).
 * The CLI loads the compiled file from dist/, with env vars supplied by
 * `node --env-file` or by Docker.
 */
export default new DataSource({
  ...buildDataSourceOptions(configuration().database),
  // Migrations own the schema here, regardless of DB_SYNCHRONIZE.
  synchronize: false,
  entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
  migrations: [join(import.meta.dirname, 'migrations', '*.js')],
});
