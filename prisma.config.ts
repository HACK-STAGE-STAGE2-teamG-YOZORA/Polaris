import { defineConfig } from 'prisma/config';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to a PostgreSQL connection URL.');
}

const protocol = new URL(databaseUrl).protocol;
if (protocol !== 'postgresql:' && protocol !== 'postgres:') {
  throw new Error('DATABASE_URL must use the postgresql: or postgres: protocol.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
