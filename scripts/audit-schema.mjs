import { readFileSync } from 'node:fs';

const schema = readFileSync('supabase/schema.sql', 'utf8');
const inventory = readFileSync('lib/database-tables.ts', 'utf8');

const statements = schema
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const schemaTables = [
  ...new Set([...schema.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map((match) => match[1]))
];

const inventoryBody = inventory.match(/databaseTables = \[([\s\S]*?)\] as const/)?.[1] ?? '';
const inventoryTables = [...inventoryBody.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);
const rlsTables = [...schema.matchAll(/alter table public\.([a-z0-9_]+) enable row level security;/g)].map((match) => match[1]);
const createPolicyStatements = statements.filter((statement) => /^create\s+policy\b/i.test(statement));

const checks = {
  schemaTables: schemaTables.length,
  inventoryTables: inventoryTables.length,
  missingFromInventory: schemaTables.filter((table) => !inventoryTables.includes(table)),
  extraInInventory: inventoryTables.filter((table) => !schemaTables.includes(table)),
  missingRls: schemaTables.filter((table) => !rlsTables.includes(table)),
  anonPolicyCreates: createPolicyStatements.filter((statement) => /\bto\s+anon\b/i.test(statement)).length,
  widePolicyCreates: createPolicyStatements.filter((statement) => /Authenticated users can manage/i.test(statement)).length,
  broadAuthAll: createPolicyStatements.filter((statement) => /\bfor\s+all\b[\s\S]*\bto\s+authenticated\b/i.test(statement)).length
};

console.log(JSON.stringify(checks, null, 2));

const failed =
  checks.missingFromInventory.length > 0 ||
  checks.extraInInventory.length > 0 ||
  checks.missingRls.length > 0 ||
  checks.anonPolicyCreates > 0 ||
  checks.widePolicyCreates > 0 ||
  checks.broadAuthAll > 0;

if (failed) {
  process.exitCode = 1;
}
