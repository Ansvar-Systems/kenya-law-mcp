#!/usr/bin/env tsx
/**
 * Kenya Law MCP -- Ingestion Pipeline
 *
 * Fetches Kenyan legislation from new.kenyalaw.org (Akoma Ntoso HTML).
 * Kenya Law provides free public access to legislation under
 * Government Open Data principles.
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached pages
 *
 * Data source: new.kenyalaw.org (National Council for Law Reporting)
 * Format: AKN (Akoma Ntoso) structured HTML
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import { parseKenyaLawHtml, KEY_KENYAN_ACTS, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<void> {
  console.log(`\nProcessing ${acts.length} Kenyan Acts from new.kenyalaw.org...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  const results: { act: string; provisions: number; definitions: number; status: string }[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
      const provCount = existing.provisions?.length ?? 0;
      const defCount = existing.definitions?.length ?? 0;
      totalProvisions += provCount;
      totalDefinitions += defCount;
      results.push({ act: act.shortName, provisions: provCount, definitions: defCount, status: 'cached' });
      skipped++;
      processed++;
      continue;
    }

    try {
      let html: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
        console.log(`  Using cached ${act.shortName} (${act.id}) (${(html.length / 1024).toFixed(0)} KB)`);
      } else {
        process.stdout.write(`  Fetching ${act.shortName} (${act.id})...`);
        const result = await fetchWithRateLimit(act.url);

        if (result.status !== 200) {
          console.log(` HTTP ${result.status}`);
          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: `HTTP ${result.status}` });
          failed++;
          processed++;
          continue;
        }

        html = result.body;
        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseKenyaLawHtml(html, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions extracted`);
      results.push({
        act: act.shortName,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'OK',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.shortName}: ${msg}`);
      results.push({ act: act.shortName, provisions: 0, definitions: 0, status: `ERROR: ${msg.substring(0, 80)}` });
      failed++;
    }

    processed++;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('Ingestion Report');
  console.log('='.repeat(70));
  console.log(`\n  Source:      new.kenyalaw.org (Akoma Ntoso HTML)`);
  console.log(`  Processed:   ${processed}`);
  console.log(`  Cached:      ${skipped}`);
  console.log(`  Failed:      ${failed}`);
  console.log(`  Total provisions:  ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);
  console.log(`\n  Per-Act breakdown:`);
  console.log(`  ${'Act'.padEnd(25)} ${'Provisions'.padStart(12)} ${'Definitions'.padStart(13)} ${'Status'.padStart(10)}`);
  console.log(`  ${'-'.repeat(25)} ${'-'.repeat(12)} ${'-'.repeat(13)} ${'-'.repeat(10)}`);
  for (const r of results) {
    console.log(`  ${r.act.padEnd(25)} ${String(r.provisions).padStart(12)} ${String(r.definitions).padStart(13)} ${r.status.padStart(10)}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('Kenya Law MCP -- Ingestion Pipeline');
  console.log('===================================\n');
  console.log(`  Source: new.kenyalaw.org (National Council for Law Reporting)`);
  console.log(`  Format: AKN (Akoma Ntoso) structured HTML`);
  console.log(`  License: Government Open Data`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const acts = limit ? KEY_KENYAN_ACTS.slice(0, limit) : KEY_KENYAN_ACTS;
  await fetchAndParseActs(acts, skipFetch);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
