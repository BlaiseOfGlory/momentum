# momentum

Security news feed aggregator. Polls RSS feeds from 14 security research blogs, stores articles in append-only JSONL, deduplicates by URL. Designed as the ingestion layer for event-based news scoring.

## Setup

```bash
git clone https://github.com/BlaiseOfGlory/momentum.git
cd momentum
bun install
```

On first run, the bundled `sources.json` is copied to `~/.config/momentum/sources.json`. Edit that file to add, remove, or re-tier feeds.

### File Locations

| File | Path | Purpose |
|------|------|---------|
| Feed config | `~/.config/momentum/sources.json` | Your feed list (auto-created from bundled defaults) |
| Article data | `~/.local/share/momentum/articles.jsonl` | Ingested articles (append-only) |

Source lookup priority: `--sources` flag > `~/.config/momentum/sources.json` > bundled `sources.json`.

## Commands

| Command | Description |
|---------|-------------|
| `momentum` | Show status: feed count, article count, last ingestion |
| `momentum ingest` | Fetch articles from all RSS feeds |
| `momentum sources` | List configured feeds |
| `momentum sources --add <url>` | Add a new RSS feed |
| `momentum articles` | Show recent articles (default 25) |

### Flags

- `--json` — Output as JSON instead of TOON format
- `--limit N` — Number of articles to show (articles command)
- `--data-dir DIR` — Custom data directory (default: `~/.local/share/momentum/`)
- `--sources FILE` — Custom sources.json path
- `--help` — Show help for any subcommand

## Default Feeds

14 security research feeds, tiered by editorial quality:

**Tier 1 (original research):** Wiz, Huntress, SpecterOps, watchtowr, Unit42, Google TAG, BHIS, Snyk, ANY.RUN, Aikido

**Tier 2 (quality reporting):** BleepingComputer, The Hacker News, Ars Technica, SANS ISC

## Output Format

Default output uses TOON (compact tabular format, ~40% fewer tokens than JSON):

```
ingest[14]{source,new,skipped,status}:
  Wiz Blog,15,0,ok
  Huntress Blog,12,0,ok
  BleepingComputer,8,0,ok
help[2]:
  Run `momentum articles` to see ingested articles
  Run `momentum sources` to see configured feeds

total: 35 new, 0 skipped, 0 errors
```

Use `--json` on any command for structured JSON output.

## Storage

Articles stored in `~/.local/share/momentum/articles.jsonl` — one JSON object per line, append-only. Queryable with `rg` and `jq`.

## Requirements

- [Bun](https://bun.sh) runtime
