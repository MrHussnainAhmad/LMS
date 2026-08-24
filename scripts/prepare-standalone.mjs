import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const standaloneDir = resolve(".next/standalone");

if (!existsSync(resolve(standaloneDir, "server.js"))) {
  throw new Error("Standalone output is missing. Create it before running npm start.");
}

mkdirSync(resolve(standaloneDir, ".next"), { recursive: true });
cpSync(resolve("public"), resolve(standaloneDir, "public"), { recursive: true });
cpSync(resolve(".next/static"), resolve(standaloneDir, ".next/static"), { recursive: true });
