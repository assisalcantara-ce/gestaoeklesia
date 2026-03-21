#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const eslintBin = path.join(process.cwd(), 'node_modules', 'eslint', 'bin', 'eslint.js');

const eslintArgs = ['.', '--config', path.join(process.cwd(), 'eslint.config.mjs')];

const env = { ...process.env };
// Garante uso do flat config mesmo que alguém tenha setado essa env var no shell.
delete env.ESLINT_USE_FLAT_CONFIG;

const result = spawnSync(process.execPath, [eslintBin, ...eslintArgs], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
