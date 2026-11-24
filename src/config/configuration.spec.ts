import configuration from './configuration.js';

const KEYS = [
  'PORT',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
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
      },
      jwt: { secret: 's', expiresIn: '2h' },
    });
  });

  it('falls back to default ports when the values are not numbers', () => {
    process.env.PORT = 'abc';
    process.env.POSTGRES_PORT = '';

    const config = configuration();
    expect(config.port).toBe(3000);
    expect(config.database.port).toBe(5432);
  });
});
