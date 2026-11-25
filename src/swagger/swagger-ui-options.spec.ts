import { swaggerUiOptions } from './swagger-ui-options.js';

describe('swaggerUiOptions', () => {
  it('serves the UI from node_modules outside Vercel', () => {
    expect(swaggerUiOptions({})).toEqual({});
  });

  it('loads the UI assets from a CDN on Vercel', () => {
    const options = swaggerUiOptions({ VERCEL: '1' });

    expect(options.customCssUrl).toMatch(
      /^https:\/\/cdnjs\.cloudflare\.com\/.+\/swagger-ui\.min\.css$/,
    );
    expect(options.customJs).toEqual([
      expect.stringMatching(/swagger-ui-bundle\.min\.js$/),
      expect.stringMatching(/swagger-ui-standalone-preset\.min\.js$/),
    ]);
  });

  it('reads process.env by default', () => {
    expect(() => swaggerUiOptions()).not.toThrow();
  });
});
