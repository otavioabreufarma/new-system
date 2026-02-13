import fs from 'node:fs/promises';
import path from 'node:path';
import { config, SERVER_TYPES } from '../config.js';

const defaultSchema = {
  users: {},
  orders: {},
  purchaseHistory: []
};

const dbPath = (serverType) => path.join(config.databaseDir, `${serverType}.json`);

export async function ensureDatabases() {
  await fs.mkdir(config.databaseDir, { recursive: true });

  for (const serverType of SERVER_TYPES) {
    const file = dbPath(serverType);
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, JSON.stringify(defaultSchema, null, 2));
    }
  }
}

export async function readDb(serverType) {
  if (!SERVER_TYPES.includes(serverType)) {
    throw new Error('Invalid server type. Expected solo or duo.');
  }

  const file = dbPath(serverType);
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw);
}

export async function writeDb(serverType, payload) {
  const file = dbPath(serverType);
  await fs.writeFile(file, JSON.stringify(payload, null, 2));
}

export async function updateDb(serverType, updater) {
  const current = await readDb(serverType);
  const next = await updater(current);
  await writeDb(serverType, next);
  return next;
}
