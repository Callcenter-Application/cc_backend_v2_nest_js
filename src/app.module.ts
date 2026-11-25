import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration.js';
import {
  buildDataSourceOptions,
  logDatabaseTarget,
  type DatabaseConfig,
} from './database/database-options.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    UserModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Pick the database by env file: .env.local (default) or .env.supabase
      // (`ENV_FILE=.env.supabase`). A missing file is skipped, e.g. in Docker,
      // where Compose injects the variables directly.
      envFilePath: process.env.ENV_FILE ?? '.env.local',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        logDatabaseTarget(db);
        return { ...buildDataSourceOptions(db), autoLoadEntities: true };
      },
    }),
  ]
})
export class AppModule {}
