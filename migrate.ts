import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log('Running raw SQL migration...');
  await sql`
    CREATE TABLE IF NOT EXISTS "platform_reviews" (
      "id" serial PRIMARY KEY NOT NULL,
      "institution_id" integer NOT NULL,
      "rating" integer NOT NULL,
      "content" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "platform_reviews_institution_id_unique" UNIQUE("institution_id")
    );
  `;
  await sql`
    DO $$ BEGIN
      ALTER TABLE "platform_reviews" ADD CONSTRAINT "platform_reviews_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "platform_pages" (
      "id" serial PRIMARY KEY NOT NULL,
      "slug" varchar(255) NOT NULL,
      "title" varchar(255) NOT NULL,
      "content" text NOT NULL,
      "last_edited_at" timestamp DEFAULT now() NOT NULL,
      "last_edited_by" integer,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "platform_pages_slug_unique" UNIQUE("slug")
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "featured_institutions" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar(255) NOT NULL,
      "logo_key" varchar(255),
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `;
  console.log('Migration complete');
  process.exit(0);
}

main().catch(console.error);
