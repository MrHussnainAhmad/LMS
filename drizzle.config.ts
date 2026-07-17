try {
  const dotenv = require('dotenv');
  dotenv.config({ path: ['.env.local', '.env'] });
} catch (e) {}

/** @type { import("drizzle-kit").Config } */
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
};
