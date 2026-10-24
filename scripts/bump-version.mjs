#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const VERSION_FILE = new URL('../version.json', import.meta.url);
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const USAGE = 'Usage: bump-version.mjs [--version MAJOR.MINOR.PATCH] [--build N]';

function fail(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const [flag, inline] = args[i].split(/=(.*)/s);
    if (flag !== '--version' && flag !== '--build') fail(`Unknown argument: ${args[i]}`);
    const value = inline ?? args[(i += 1)];
    if (value === undefined || value === '') fail(`${flag} needs a value`);
    options[flag.slice(2)] = value;
  }
  return options;
}

function parseBuild(value) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    fail(`--build must be a positive integer; got "${value}"`);
  }
  return Number(value);
}

const current = JSON.parse(readFileSync(VERSION_FILE, 'utf8'));
if (typeof current.version !== 'string' || !Number.isInteger(current.build) || current.build < 1) {
  fail('version.json must hold { "version": "MAJOR.MINOR.PATCH", "build": N }');
}

const options = parseArgs(process.argv.slice(2));
if (options.version !== undefined && !VERSION_PATTERN.test(options.version)) {
  fail(`--version must be MAJOR.MINOR.PATCH digits; got "${options.version}"`);
}

const explicit = options.version !== undefined || options.build !== undefined;
const version = options.version ?? current.version;
const build =
  options.build !== undefined ? parseBuild(options.build) : explicit ? current.build : current.build + 1;

writeFileSync(VERSION_FILE, `{ "version": ${JSON.stringify(version)}, "build": ${build} }\n`);
console.log(`version.json: version ${version}, build ${build}`);
