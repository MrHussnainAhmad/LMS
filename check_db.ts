import { db } from "./src/db";
import { platformPages } from "./src/db/schema";

async function run() {
  const pages = await db.select().from(platformPages);
  console.log("Pages in DB:");
  console.log(pages);
}
run();
