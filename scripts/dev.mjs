import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn(process.execPath, ['server/index.mjs'], { cwd: root, stdio: 'inherit', env: process.env });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '5180', '--strictPort', '--force'], { cwd: root, stdio: 'inherit', env: process.env });
const stop = () => { server.kill(); vite.kill(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', code => { if (code && code !== 0) { vite.kill(); process.exit(code); } });
vite.on('exit', code => { server.kill(); if (code && code !== 0) process.exit(code); });
