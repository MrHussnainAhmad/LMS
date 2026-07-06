import { hash } from '@node-rs/argon2';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function createSuperAdmin() {
  console.log('--- Super Admin Setup ---');

  // Dynamically import db AFTER dotenv has loaded the env variables
  const { db } = await import('../src/db');
  const { superAdmins } = await import('../src/db/schema');
  
  const existingAdmins = await db.select().from(superAdmins).limit(1);
  if (existingAdmins.length > 0) {
    console.error('\n❌ A Super Admin already exists in the database. Only one Super Admin is allowed.');
    process.exit(1);
  }

  const email = await question('Enter Super Admin Email: ');
  const password = await question('Enter Super Admin Password: ');
  const securityQuestion = await question('Enter Security Question (e.g. What is your favorite color?): ');
  const securityAnswer = await question('Enter Security Answer: ');

  if (!email || !password || !securityQuestion || !securityAnswer) {
    console.error('\n❌ All fields are required. Setup aborted.');
    process.exit(1);
  }

  console.log('\nCreating Super Admin account...');

  const passwordHash = await hash(password);
  const securityAnswerHash = await hash(securityAnswer.toLowerCase().trim());

  await db.insert(superAdmins).values({
    email,
    passwordHash,
    securityQuestion,
    securityAnswerHash,
  });

  console.log('✅ Super Admin created successfully!');
  process.exit(0);
}

createSuperAdmin().catch(err => {
  console.error('\n❌ Error creating Super Admin:', err);
  process.exit(1);
});
