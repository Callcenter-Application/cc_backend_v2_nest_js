import configuration from './configuration.js';

const KEYS = [
  'PORT',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'POSTGRES_SSL',
  'DB_SYNCHRONIZE',
  'POSTGRES_POOL_MAX',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
];

describe('configuration', () => {
  const original = { ...process.env };

  beforeEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  afterAll(() => {
    process.env = original;
  });

  it('falls back to defaults when env vars are missing', () => {
    expect(configuration()).toEqual({
      port: 3000,
      database: {
        host: 'localhost',
        port: 5432,
        username: undefined,
        password: undefined,
        name: undefined,
        ssl: false,
        synchronize: false,
        poolMax: 10,
      },
      jwt: { secret: 'dev-secret-change-me', expiresIn: '1h' },
    });
  });

  it('reads and parses env vars', () => {
    Object.assign(process.env, {
      PORT: '3015',
      POSTGRES_HOST: 'db',
      POSTGRES_PORT: '6543',
      POSTGRES_USER: 'u',
      POSTGRES_PASSWORD: 'p',
      POSTGRES_DB: 'callbook',
      POSTGRES_SSL: 'true',
      DB_SYNCHRONIZE: 'true',
      POSTGRES_POOL_MAX: '2',
      JWT_SECRET: 's',
      JWT_EXPIRES_IN: '2h',
    });

    expect(configuration()).toEqual({
      port: 3015,
      database: {
        host: 'db',
        port: 6543,
        username: 'u',
        password: 'p',
        name: 'callbook',
        ssl: true,
        synchronize: true,
        poolMax: 2,
      },
      jwt: { secret: 's', expiresIn: '2h' },
    });
  });

  it('only enables ssl and synchronize with the exact value "true"', () => {
    process.env.POSTGRES_SSL = '1';
    process.env.DB_SYNCHRONIZE = 'yes';

    const { database } = configuration();
    expect(database.ssl).toBe(false);
    expect(database.synchronize).toBe(false);
  });

  it('falls back to default ports and pool size when the values are not numbers', () => {
    process.env.PORT = 'abc';
    process.env.POSTGRES_PORT = '';
    process.env.POSTGRES_POOL_MAX = 'x';

    const config = configuration();
    expect(config.port).toBe(3000);
    expect(config.database.port).toBe(5432);
    expect(config.database.poolMax).toBe(10);
  });
});
