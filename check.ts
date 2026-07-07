import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "./src/db";
import { sections, staff } from "./src/db/schema";

async function run() {
  const allSections = await db.select({
    id: sections.id,
    name: sections.name,
    classTeacherId: sections.classTeacherId,
  }).from(sections);
  console.log("SECTIONS:");
  console.table(allSections);

  const allStaff = await db.select({
    id: staff.id,
    name: staff.name,
    email: staff.email,
  }).from(staff);
  console.log("STAFF:");
  console.table(allStaff);

  process.exit(0);
}

run().catch(console.error);
