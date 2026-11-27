import {
  buildDataSourceOptions,
  isSupabaseHost,
  logDatabaseTarget,
  type DatabaseConfig,
} from './database-options.js';

const local: DatabaseConfig = {
  host: 'localhost',
  port: 5432,
  username: 'test',
  password: 'test',
  name: 'callbook_db',
  ssl: false,
  synchronize: true,
  poolMax: 10,
};

const supabase: DatabaseConfig = {
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 5432,
  username: 'postgres.abcdef',
  password: 'secret',
  name: 'postgres',
  ssl: true,
  synchronize: false,
  poolMax: 2,
};

describe('isSupabaseHost', () => {
  it.each([
    ['aws-0-us-west-2.pooler.supabase.com', true],
    ['db.abcdef.supabase.co', true],
    ['localhost', false],
    ['db', false],
    ['supabase.com.evil.example', false],
  ])('%s -> %s', (host, expected) => {
    expect(isSupabaseHost(host)).toBe(expected);
  });
});

describe('buildDataSourceOptions', () => {
  it('maps a local config without ssl', () => {
    expect(buildDataSourceOptions(local)).toEqual({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'callbook_db',
      ssl: false,
      synchronize: true,
      extra: { max: 10 },
    });
  });

  it('enables ssl for Supabase', () => {
    expect(buildDataSourceOptions(supabase)).toMatchObject({
      host: supabase.host,
      ssl: { rejectUnauthorized: false },
      synchronize: false,
      extra: { max: 2 },
    });
  });

  it('refuses synchronize against Supabase', () => {
    expect(() =>
      buildDataSourceOptions({ ...supabase, synchronize: true }),
    ).toThrow(/not allowed against Supabase/);
  });
});

describe('logDatabaseTarget', () => {
  const logger = { log: vi.fn(), warn: vi.fn() };

  beforeEach(() => vi.clearAllMocks());

  it('logs a local database as info', () => {
    logDatabaseTarget(local, logger);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'Connected database: LOCAL -> localhost:5432/callbook_db (ssl: off, synchronize: on)',
    );
  });

  it('warns that requests will modify the Supabase database', () => {
    logDatabaseTarget(supabase, logger);

    expect(logger.log).not.toHaveBeenCalled();
    const [message] = logger.warn.mock.calls[0];
    expect(message).toContain(
      'SUPABASE -> aws-0-us-west-2.pooler.supabase.com:5432/postgres (ssl: on, synchronize: off)',
    );
    expect(message).toContain('will modify the Supabase database');
    expect(message).not.toContain(supabase.password);
  });

  it('handles a missing database name and uses a Nest logger by default', () => {
    expect(() => logDatabaseTarget({ ...local, name: undefined })).not.toThrow();
  });
});
