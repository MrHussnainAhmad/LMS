import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
}
import { db } from "./src/db/index.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`ALTER TABLE batch_exam_subjects ADD COLUMN published_at timestamp;`);
    console.log("Column added successfully!");
  } catch (error) {
    console.error("Error adding column:", error);
  }
  process.exit(0);
}

main();
