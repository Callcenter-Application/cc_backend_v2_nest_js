import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const config = new DocumentBuilder()
    .setTitle('CallBook')
    .setDescription('This is the second version of my callcenter backend')
    .setVersion('2.0')
    .addTag('Handler')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);
  const port = process.env.PORT ?? 3000
  await app.listen(port);
  console.log(`API is running in http://localhost:${port}`);
  console.log(`Swagger is running in http://localhost:${port}/docs`)

}
await bootstrap();
