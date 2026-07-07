const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon("postgresql://neondb_owner:npg_JVHRBs8hAt6L@ep-red-hall-aoccj342.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require");
  try {
    await sql`ALTER TABLE students ADD COLUMN emergency_contact VARCHAR(50)`;
    console.log("Added emergency_contact");
  } catch (e) {
    console.log("emergency_contact probably exists", e.message);
  }
  
  try {
    await sql`ALTER TABLE students ADD COLUMN parental_whatsapp VARCHAR(50)`;
    console.log("Added parental_whatsapp");
  } catch (e) {
    console.log("parental_whatsapp probably exists", e.message);
  }
}
main().catch(console.error);
