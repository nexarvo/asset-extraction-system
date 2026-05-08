import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseConfig } from './database.config';

export default new DataSource({
  type: 'postgres',
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
  migrationsTableName: 'migrations',
  migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
});
