import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/db");
  const { staffAssignments } = await import("../src/db/schema");
  
  await db.delete(staffAssignments).execute();
  console.log("Cleared assignments");
  process.exit(0);
}

main();
