import type { SwaggerCustomOptions } from '@nestjs/swagger';

// Same major version as the bundled swagger-ui-dist (5.x).
const SWAGGER_UI_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14';

/**
 * On Vercel the function bundle doesn't ship swagger-ui-dist's static files,
 * so /docs would render blank. There the UI assets are loaded from a CDN;
 * everywhere else Nest serves them from node_modules.
 */
export function swaggerUiOptions(
  env: NodeJS.ProcessEnv = process.env,
): SwaggerCustomOptions {
  if (!env.VERCEL) {
    return {};
  }
  return {
    customCssUrl: `${SWAGGER_UI_CDN}/swagger-ui.min.css`,
    customJs: [
      `${SWAGGER_UI_CDN}/swagger-ui-bundle.min.js`,
      `${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.min.js`,
    ],
  };
}
