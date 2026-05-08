import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { databaseConfig } from './database.config';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
  synchronize: false,
  logging: process.env.LOG_SQL === 'true' ? ['error', 'warn', 'query'] : false,
  entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
  migrationsTableName: 'migrations',
  migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
  migrationsRun: false,
  extra: {
    max: 20,
    min: 5,
  },
};

export default typeOrmConfig;
