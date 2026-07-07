const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://taleem_owner:2O9wvnYItpQS@ep-jolly-water-a17p6u4p.ap-southeast-1.aws.neon.tech/taleem?sslmode=require"
  });

  await client.connect();

  const sections = await client.query('SELECT id, name, "class_teacher_id", "institution_id" FROM sections;');
  console.log("SECTIONS:", sections.rows);

  const staff = await client.query('SELECT id, name, "institution_id" FROM staff;');
  console.log("STAFF:", staff.rows);

  await client.end();
}

run().catch(console.error);
