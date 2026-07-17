import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Patch console.error to prevent dumping huge PG error objects with undefined fields
const originalError = console.error;
console.error = (...args: any[]) => {
  const newArgs = args.map(arg => {
    if (arg instanceof Error && 'schema' in arg && 'table' in arg) {
      return {
        message: arg.message,
        code: (arg as any).code,
        stack: arg.stack,
      };
    }
    return arg;
  });
  originalError(...newArgs);
};

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL!,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  application_name: 'nisaab360_api'
});
export const db = drizzle(pool, { schema });
