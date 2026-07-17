#!/usr/bin/env node

import { hash, verify } from "@node-rs/argon2";
import pg from "pg";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const { Client } = pg;
const DEFAULT_SECURITY_QUESTION = "What is your secret phrase?";

function required(value, name) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

async function promptHidden(label) {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error(
      `Cannot securely prompt for ${label.toLowerCase()} without a TTY. ` +
        "Provide the corresponding SUPER_ADMIN_* environment variable.",
    );
  }

  return new Promise((resolve, reject) => {
    const previousRawMode = stdin.isRaw;
    let value = "";

    const finish = (error) => {
      stdin.off("data", onData);
      stdin.setRawMode(Boolean(previousRawMode));
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    };

    stdout.write(`${label}: `);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function collectCredentials() {
  const readline = createInterface({ input: stdin, output: stdout });
  let email;
  let securityQuestion;

  try {
    email = process.env.SUPER_ADMIN_EMAIL;
    if (!email) email = await readline.question("Super-admin email: ");

    securityQuestion = process.env.SUPER_ADMIN_SECURITY_QUESTION;
    if (!securityQuestion) {
      const enteredQuestion = await readline.question(
        `Security question [${DEFAULT_SECURITY_QUESTION}]: `,
      );
      securityQuestion = enteredQuestion.trim() || DEFAULT_SECURITY_QUESTION;
    }
  } finally {
    readline.close();
  }

  let password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    password = await promptHidden("Password");
    const confirmation = await promptHidden("Confirm password");
    if (password !== confirmation) throw new Error("Passwords do not match.");
  }

  let securityAnswer = process.env.SUPER_ADMIN_SECURITY_ANSWER;
  if (!securityAnswer) {
    securityAnswer = await promptHidden("Security answer");
    const confirmation = await promptHidden("Confirm security answer");
    if (securityAnswer !== confirmation) {
      throw new Error("Security answers do not match.");
    }
  }

  email = required(email, "Email").toLowerCase();
  securityQuestion = required(securityQuestion, "Security question");
  securityAnswer = required(securityAnswer, "Security answer").toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email is invalid.");
  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  return { email, password, securityQuestion, securityAnswer };
}

async function main() {
  const connectionString =
    process.env.SUPER_ADMIN_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Set SUPER_ADMIN_DATABASE_URL, DIRECT_URL, or DATABASE_URL before running this script.",
    );
  }

  const credentials = await collectCredentials();
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id FROM super_admins WHERE lower(email) = $1 LIMIT 1",
      [credentials.email],
    );
    if (existing.rowCount) {
      throw new Error(`A super admin with email ${credentials.email} already exists.`);
    }

    const [passwordHash, securityAnswerHash] = await Promise.all([
      hash(credentials.password),
      hash(credentials.securityAnswer),
    ]);

    const passwordVerified = await verify(passwordHash, credentials.password);
    const securityAnswerVerified = await verify(
      securityAnswerHash,
      credentials.securityAnswer,
    );
    if (!passwordVerified || !securityAnswerVerified) {
      throw new Error("Credential hash verification failed.");
    }

    const result = await client.query(
      `INSERT INTO super_admins
        (email, password_hash, security_question, security_answer_hash, is_super_admin)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email`,
      [
        credentials.email,
        passwordHash,
        credentials.securityQuestion,
        securityAnswerHash,
      ],
    );

    await client.query("COMMIT");
    console.log(
      `Super admin created successfully: id=${result.rows[0].id}, email=${result.rows[0].email}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Failed to create super admin: ${error.message}`);
  process.exitCode = 1;
});
