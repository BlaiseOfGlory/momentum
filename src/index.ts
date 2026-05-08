#!/usr/bin/env bun

import { ingestCommand } from "./commands/ingest.js";
import { sourcesCommand } from "./commands/sources.js";
import { articlesCommand } from "./commands/articles.js";
import { statusCommand } from "./commands/status.js";

const MAIN_HELP = `momentum — Security news feed aggregator for AI agents

Usage: momentum [subcommand] [args...] [--json] [--help]

  ingest                        Fetch articles from all RSS feeds
  sources                       List configured feeds
  sources --add <rss_url>       Add a new RSS feed
  articles [--limit N]          Show recent articles (default 25)

Flags:
  --json          Output as JSON instead of TOON format
  --data-dir DIR  Custom data directory (default: ~/.local/share/momentum/)
  --sources FILE  Custom sources.json path

No-args shows status. Requires no authentication.`;

const SUBCOMMAND_HELP: Record<string, string> = {
  ingest: `momentum ingest — Fetch articles from all configured RSS feeds

Usage: momentum ingest [--json] [--sources FILE] [--data-dir DIR]

Polls each feed in parallel. New articles are appended to articles.jsonl.
Duplicate URLs are skipped automatically.`,

  sources: `momentum sources — List or manage RSS feed sources

Usage: momentum sources [--json] [--sources FILE]
       momentum sources --add <rss_url>

Lists all configured feeds with name, domain, tier, and URL.
Use --add to register a new feed (defaults to tier 3).`,

  articles: `momentum articles — Browse ingested articles

Usage: momentum articles [--limit N] [--json] [--data-dir DIR]

Shows the most recent articles (default 25, newest first).
Use --json for full article records including IDs and URLs.`,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  if (args.includes("--help") || args.includes("-h")) {
    if (subcommand && subcommand in SUBCOMMAND_HELP) {
      console.log(SUBCOMMAND_HELP[subcommand]);
    } else {
      console.log(MAIN_HELP);
    }
    return;
  }

  if (!subcommand) {
    await statusCommand(args);
    return;
  }

  const subArgs = args.slice(1);

  switch (subcommand) {
    case "ingest":
      await ingestCommand(subArgs);
      break;
    case "sources":
      sourcesCommand(subArgs);
      break;
    case "articles":
      await articlesCommand(subArgs);
      break;
    case "status":
      await statusCommand(subArgs);
      break;
    default:
      console.error(`error: unknown command '${subcommand}'`);
      console.error(`Run \`momentum --help\` to see available commands`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`error: ${err.message || err}`);
  process.exit(1);
});
