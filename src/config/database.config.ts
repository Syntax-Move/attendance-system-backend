import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const isProduction = process.env.NODE_ENV === 'prod';
  const useSSL = process.env.DB_SSL === 'true' || isProduction;
  console.log({isProduction, useSSL, NODE_ENV: process.env.NODE_ENV});
  return {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '29011999',
    database: process.env.DB_NAME || 'attendance_system',
    autoLoadModels: true,
    synchronize: !isProduction,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    // SSL configuration for remote databases (e.g., Aiven, AWS RDS, etc.)
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          },
        }
      : {},
  };
});

