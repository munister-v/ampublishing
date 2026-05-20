#!/usr/bin/env node
import crypto from 'node:crypto';
import readline from 'node:readline';

const ITER = 250000;

const ask = (q) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); resolve(a); });
  });

const password = process.argv[2] || (await ask('New admin password: '));
if (!password || password.length < 12) {
  console.error('Refusing: password must be at least 12 characters.');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, ITER, 32, 'sha256');

console.log('\nPaste these into services/api.ts:\n');
console.log(`const ADMIN_PASSWORD_SALT_B64 = '${salt.toString('base64')}';`);
console.log(`const ADMIN_PASSWORD_HASH_B64 = '${hash.toString('base64')}';`);
console.log(`const ADMIN_PASSWORD_ITER = ${ITER};`);
