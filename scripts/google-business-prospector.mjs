#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { runGoogleBusinessProspecting } from './lib/google-business-prospector.mjs';

const args = parseArgs(process.argv.slice(2));
const projectRoot = process.cwd();
const stateDir = path.resolve(args.stateDir || process.env.LOOPS_STATE_DIR || path.join(projectRoot, '.loops'));

const payload = {
  config_path: args.config || 'scripts/outreach.prospects.json',
  limit_per_query: args.limitPerQuery,
  max_new: args.maxNew,
  min_rating: args.minRating,
  min_user_rating_count: args.minUserRatingCount,
  api_key_env: args.apiKeyEnv,
};

if (args.queries.length > 0) {
  payload.queries = args.queries.map((query, index) => ({
    id: `cli-${index + 1}`,
    text_query: args.location ? `${query} ${args.location}` : query,
    segment: args.segment || 'google-local-business',
    priority: 0.82,
    fit_score: 0.8,
  }));
}

const result = await runGoogleBusinessProspecting({
  projectRoot,
  stateDir,
  task: { payload },
  dryRun: args.dryRun,
  now: new Date(),
});

if (args.json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  const lines = [
    `Google business prospecting: ${result.ok ? 'ok' : 'failed'}`,
    `summary: ${result.summary || result.error || ''}`,
  ];
  if (result.config_path) lines.push(`config: ${result.config_path}`);
  if (result.generated_count !== undefined) lines.push(`generated: ${result.generated_count}`);
  if (result.needs_api_key) lines.push('next: set GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY in the environment');
  if (result.artifact_paths?.markdown) lines.push(`review: ${result.artifact_paths.markdown}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (!result.ok) process.exitCode = 1;

function parseArgs(argv) {
  const out = {
    queries: [],
    dryRun: false,
    json: false,
    config: '',
    stateDir: '',
    segment: '',
    location: '',
    apiKeyEnv: undefined,
    limitPerQuery: undefined,
    maxNew: undefined,
    minRating: undefined,
    minUserRatingCount: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    if (arg === '--query') out.queries.push(required(next(), arg));
    else if (arg === '--location') out.location = required(next(), arg);
    else if (arg === '--segment') out.segment = required(next(), arg);
    else if (arg === '--config') out.config = required(next(), arg);
    else if (arg === '--state-dir') out.stateDir = required(next(), arg);
    else if (arg === '--api-key-env') out.apiKeyEnv = required(next(), arg);
    else if (arg === '--limit-per-query') out.limitPerQuery = required(next(), arg);
    else if (arg === '--max-new') out.maxNew = required(next(), arg);
    else if (arg === '--min-rating') out.minRating = required(next(), arg);
    else if (arg === '--min-user-rating-count') out.minUserRatingCount = required(next(), arg);
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--help' || arg === '-h') {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return out;
}

function required(value, flag) {
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function printHelpAndExit() {
  process.stdout.write(`Google business prospecting

Usage:
  node scripts/google-business-prospector.mjs --json
  node scripts/google-business-prospector.mjs --query "台中 甜點禮盒" --location "台中" --max-new 10 --json

Options:
  --query <text>                  Override configured queries. Repeatable.
  --location <text>               Append a location to CLI queries.
  --segment <id>                  Segment id for CLI queries.
  --config <path>                 Outreach config path. Default scripts/outreach.prospects.json
  --state-dir <path>              State/artifact directory. Default .loops
  --api-key-env <name>            API key env name. Default GOOGLE_MAPS_API_KEY
  --limit-per-query <n>           Places Text Search page size. Default 8
  --max-new <n>                   Max prospects to append. Default 20
  --min-rating <n>                Optional rating floor.
  --min-user-rating-count <n>     Optional review-count floor.
  --dry-run                       Fetch and report without writing config/artifacts.
  --json                          Print JSON.

Environment:
  GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY must be set for live Google requests.
`);
  process.exit(0);
}
