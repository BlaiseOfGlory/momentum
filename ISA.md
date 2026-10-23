---
task: Build RSS ingestion pipeline for Momentum news scorer
slug: momentum-rss
effort: advanced
phase: complete
progress: 46/46
project: momentum
started: 2026-05-08T22:40:00Z
updated: 2026-06-10T17:35:00Z
---

## Problem

The Momentum design spec defines 14 RSS feeds as a primary ingestion source, but no code exists yet. Articles from security news sources need to be polled, parsed, deduplicated, and stored so the event classification and momentum scoring layers (future work) have data to operate on.

## Vision

Run `momentum ingest` and watch 14 security feeds get polled, new articles stored in JSONL, duplicates skipped — clean, inspectable, ready for downstream event clustering. Run `momentum sources` to see what's configured. Run `momentum articles` to see what's been collected. AXI-compliant CLI that dcord established the pattern for.

## Out of Scope

Event classification, momentum scoring, video scoring, Discord ingestion, embedding generation — all future layers. This is ingestion + storage + basic CLI only.

## Constraints

- Bun runtime, TypeScript only
- AXI-compliant output: TOON format, help[] footers, structured errors to stderr
- Flat file storage (JSONL for articles, JSON for sources) — no database
- Data directory: `~/.local/share/momentum/`
- Must handle RSS feed failures gracefully (one feed down doesn't block others)

## Goal

Build a working RSS ingestion CLI (`momentum`) in Bun/TypeScript that polls 14 configurable security news feeds, parses articles from RSS/Atom XML, deduplicates by URL, stores in append-only JSONL, and exposes results via AXI-compliant subcommands (`ingest`, `sources`, `articles`).

## Criteria

- [x] ISC-1: `package.json` exists with name "momentum", bun bin entry, and required dependencies
- [x] ISC-2: `src/index.ts` entry point with subcommand routing (ingest, sources, articles, help)
- [x] ISC-3: Source registry (`sources.json`) defines 14 feeds with name, domain, rss_url, tier
- [x] ISC-4: RSS feed URLs are real and fetchable (verified against at least 3 feeds)
- [x] ISC-5: RSS/Atom XML parser extracts title, link, and pubDate from feed entries
- [x] ISC-6: Parser handles both RSS 2.0 (`<item>`) and Atom (`<entry>`) feed formats
- [x] ISC-7: `momentum ingest` fetches all configured feeds in parallel
- [x] ISC-8: `momentum ingest` reports per-feed success/failure count in TOON format
- [x] ISC-9: Failed feeds log errors to stderr but don't halt ingestion of other feeds
- [x] ISC-10: Articles are stored in `~/.local/share/momentum/articles.jsonl` as one JSON object per line
- [x] ISC-11: Each article record includes: id, url, title, domain, source_tier, ingested_at, origin ("rss"), event_id (null)
- [x] ISC-12: URL deduplication — articles with URLs already in articles.jsonl are skipped
- [x] ISC-13: URL normalization strips trailing slashes, query params (utm_*), and fragments before dedup check
- [x] ISC-14: `momentum sources` lists all configured feeds in TOON format (name, domain, tier, rss_url)
- [x] ISC-15: `momentum articles` lists recent articles in TOON format (title, domain, source_tier, ingested_at)
- [x] ISC-16: `momentum articles --limit N` controls how many articles to show (default 25)
- [x] ISC-17: `momentum articles --json` outputs JSON instead of TOON
- [x] ISC-18: `--help` on any subcommand shows usage without requiring network access
- [x] ISC-19: No-args `momentum` shows status: feed count, article count, last ingestion time
- [x] ISC-20: Data directory `~/.local/share/momentum/` is created automatically on first run
- [x] ISC-21: TOON output uses the same format patterns as dcord (name[count]{fields}: rows)
- [x] ISC-22: Structured errors go to stderr with message, detail, help[] fields
- [x] ISC-23: `momentum ingest` shows a help[] footer with next-step suggestions after completion
- [x] ISC-24: Source registry is loadable from a custom path via `--sources` flag
- [x] ISC-25: Articles JSONL is loadable from a custom path via `--data-dir` flag
- [x] ISC-26: HTTP fetch uses appropriate User-Agent header
- [x] ISC-27: HTTP fetch has a per-feed timeout (10 seconds)
- [x] ISC-28: `momentum sources --add <url>` adds a new feed to sources.json (with auto-detected name/tier)
- [x] ISC-29: Anti: `momentum ingest` does NOT process full article body content — only title + link + pubDate from feed XML
- [x] ISC-30: XML parsing uses a single zero-dependency library (fast-xml-parser) — no heavy frameworks
- [x] ISC-31: `.gitignore` excludes node_modules/ and .env
- [x] ISC-32: README.md with setup and command reference
- [x] ISC-33: `bun run src/index.ts` executes without errors when no data directory exists yet
- [x] ISC-34: Anti: No hardcoded paths — data directory derived from env or default
- [x] ISC-35: `https://illusivedan.com/rss.xml` returns HTTP 200 with valid RSS 2.0 XML
- [x] ISC-36: Live config `~/.config/momentum/sources.json` contains illusivedan.com entry (name "Dan Guido (illusivedan)", tier 1, bias ai-security+industry)
- [x] ISC-37: Repo bundled `sources.json` contains the identical illusivedan.com entry
- [x] ISC-38: Live config contains daniel.haxx.se entry (drift sync from repo copy)
- [x] ISC-39: Both registry files parse as valid JSON with 16 entries and no duplicate domains
- [x] ISC-40: `momentum sources` lists Dan Guido (illusivedan) at tier 1
- [x] ISC-41: `momentum ingest` reports illusivedan feed status ok with new articles stored
- [x] ISC-42: `articles.jsonl` contains illusivedan.com articles with origin "rss" and source_tier 1
- [x] ISC-43: Re-running ingest yields 0 new illusivedan articles (URL dedup holds)
- [x] ISC-44: Anti: no pre-existing source entry removed or modified in either registry
- [x] ISC-45: Anti: illusivedan NOT added to watchlist.json — RSS exists; the watchlist is the scraper fallback for non-RSS sites
- [x] ISC-46: curl feed (daniel.haxx.se) ingests successfully after drift sync

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|-----|------|-------|-----------|------|
| ISC-1 | file | Read package.json | name=momentum, bin entry exists | Read |
| ISC-2 | file | Read src/index.ts | Subcommand routing for ingest/sources/articles | Read |
| ISC-3 | file | Read sources.json | 14 entries with name/domain/rss_url/tier | Read |
| ISC-4 | runtime | Fetch 3+ feed URLs | HTTP 200 + valid XML | Bash curl |
| ISC-5 | runtime | Ingest and check articles.jsonl | title + url + pubDate present | Bash |
| ISC-6 | runtime | Ingest feeds with both RSS and Atom formats | Both produce articles | Bash |
| ISC-7 | code | Read ingest command | Promise.allSettled or parallel pattern | Read |
| ISC-8 | runtime | Run momentum ingest | TOON output with per-feed counts | Bash |
| ISC-9 | runtime | Test with one invalid feed URL | Other feeds still ingested | Bash |
| ISC-10 | file | Check articles.jsonl exists after ingest | Valid JSONL | Bash |
| ISC-11 | runtime | Read first line of articles.jsonl | All 7 fields present | Bash |
| ISC-12 | runtime | Run ingest twice | Second run shows 0 new articles (or fewer) | Bash |
| ISC-13 | code | Read URL normalization function | Strips trailing slash, utm_*, fragments | Read |
| ISC-14 | runtime | Run momentum sources | TOON table with 14 rows | Bash |
| ISC-15 | runtime | Run momentum articles | TOON table with recent articles | Bash |
| ISC-16 | runtime | Run momentum articles --limit 5 | Shows exactly 5 | Bash |
| ISC-17 | runtime | Run momentum articles --json | Valid JSON array | Bash |
| ISC-18 | runtime | Run momentum ingest --help | Help text, no network call | Bash |
| ISC-19 | runtime | Run momentum (no args) | Shows feed count + article count | Bash |
| ISC-20 | runtime | Delete data dir, run momentum | Dir created automatically | Bash |
| ISC-21 | runtime | Compare output format with dcord | Same TOON pattern | Bash |
| ISC-22 | code | Read error handling | exitWithError to stderr | Read |
| ISC-23 | runtime | Run momentum ingest | help[] footer present | Bash |
| ISC-24 | code | Read flag parsing | --sources flag handled | Read |
| ISC-25 | code | Read flag parsing | --data-dir flag handled | Read |
| ISC-26 | code | Read fetch call | User-Agent header set | Read |
| ISC-27 | code | Read fetch call | AbortController or timeout option | Read |
| ISC-28 | runtime | Run momentum sources --add URL | New entry in sources.json | Bash |
| ISC-29 | code | Read ingest logic | No body/content extraction | Read |
| ISC-30 | file | Read package.json | No xml2js, fast-xml-parser, etc. | Read |
| ISC-31 | file | Read .gitignore | node_modules/ and .env listed | Read |
| ISC-32 | file | Read README.md | Setup + commands documented | Read |
| ISC-33 | runtime | Run from clean state | No crash, creates data dir | Bash |
| ISC-34 | code | Grep for hardcoded paths | No /home/harvey or absolute paths | Grep |
| ISC-35 | runtime | curl rss.xml | HTTP 200, RSS 2.0, ≥1 item | Bash curl |
| ISC-36 | file | Read live config | Entry with all 5 fields correct | Read |
| ISC-37 | file | Read repo sources.json | Identical entry | Read |
| ISC-38 | file | Read live config | daniel.haxx.se entry present | Read |
| ISC-39 | runtime | JSON parse both files | 16 entries each, no dupe domains | Bash |
| ISC-40 | runtime | momentum sources | Row for illusivedan tier 1 | Bash |
| ISC-41 | runtime | momentum ingest | "Dan Guido (illusivedan),N,ok" | Bash |
| ISC-42 | runtime | rg articles.jsonl | origin=rss, source_tier=1 | Bash |
| ISC-43 | runtime | Second ingest run | 0 new, 4 skipped | Bash |
| ISC-44 | runtime | Domain-list before/after compare | Only additions, no removals | Bash |
| ISC-45 | file | Read watchlist.json | No illusivedan entry | Read |
| ISC-46 | runtime | momentum ingest | "Daniel Stenberg (curl),10,ok" | Bash |

## Features

| Name | Description | Satisfies | Depends On | Parallelizable |
|------|-------------|-----------|------------|----------------|
| project-scaffold | package.json, tsconfig, .gitignore, entry point | ISC-1, ISC-31 | — | yes |
| format-module | TOON/JSON formatter (port from dcord patterns) | ISC-21, ISC-22 | — | yes |
| source-registry | sources.json with 14 feeds, load/save, --add | ISC-3, ISC-24, ISC-28 | project-scaffold | yes |
| rss-parser | Fetch + parse RSS/Atom XML, extract title/link/pubDate | ISC-5, ISC-6, ISC-26, ISC-27, ISC-29, ISC-30 | — | yes |
| article-store | JSONL read/write, URL dedup, normalization | ISC-10, ISC-11, ISC-12, ISC-13, ISC-20, ISC-25, ISC-34 | — | yes |
| cmd-ingest | Parallel feed fetch, store articles, report results | ISC-7, ISC-8, ISC-9, ISC-23 | rss-parser, article-store, source-registry | no |
| cmd-sources | List feeds, --add support | ISC-14, ISC-28 | source-registry, format-module | no |
| cmd-articles | List articles with --limit, --json | ISC-15, ISC-16, ISC-17 | article-store, format-module | no |
| cmd-status | No-args status display | ISC-19 | article-store, source-registry | no |
| cli-routing | Entry point, subcommand dispatch, --help | ISC-2, ISC-18 | all commands | no |
| readme | Setup and command docs | ISC-32 | cli-routing | no |
| feed-verification | Verify RSS URLs are real and fetchable | ISC-4 | rss-parser | no |
| add-illusivedan-feed | Dan Guido blog as tier-1 RSS source + curl-feed drift sync | ISC-35..ISC-46 | source-registry | no |

## Decisions

- 2026-06-10: Added illusivedan.com (Dan Guido, Trail of Bits CEO) as tier 1 with category_bias [ai-security, industry]. Site declares RSS at /rss.xml, so it belongs in sources.json — not watchlist.json (the scraper list, reserved for non-RSS sites).
- 2026-06-10: Drift found and fixed — "Daniel Stenberg (curl)" existed only in the repo's bundled sources.json, never in the live `~/.config/momentum/sources.json` that ingest actually reads (0 articles ever ingested). Root cause: repo copy edited after the first-run fork; the live config is the ingestion point. Synced. Watch for this on future source additions: edit the live config, mirror to repo.
- 2026-06-10: show-math — delegation floor (E2 ≥1) relaxed: single-registry config edit plus one CLI verification run; an agent adds spawn latency with zero parallelism benefit. ISC soft floor 16 → 12: natural atomic-probe granularity produced 12; padding would create non-atomic filler.

## Verification

- ISC-35: curl — HTTP 200, `<rss version="2.0">`, 4 items (Hacker Spirit Scholarship, Archive interview, ACCORD, killer script kiddies)
- ISC-36/37: Read — both files carry identical entry: name "Dan Guido (illusivedan)", domain illusivedan.com, rss_url https://illusivedan.com/rss.xml, tier 1, bias [ai-security, industry]
- ISC-38: Read — daniel.haxx.se entry now in live config
- ISC-39: python json.load — live: 16, repo: 16, dupes: False
- ISC-40: Bash — `Dan Guido (illusivedan),illusivedan.com,1,https://illusivedan.com/rss.xml`
- ISC-41: Bash — ingest run: `Dan Guido (illusivedan),4,0,ok`
- ISC-42: rg articles.jsonl — 4 records, all `"origin":"rss","source_tier":1` (e.g. "The whole Trail of Bits story")
- ISC-43: Bash — second ingest: `Dan Guido (illusivedan),0,4,ok`
- ISC-44: Bash — live went 14→16 (two additions), repo 15→16 (one addition); domain lists otherwise identical
- ISC-45: Read — watchlist.json unchanged: afflicted.sh, stuart-thomas.com, red.anthropic.com only
- ISC-46: Bash — ingest run: `Daniel Stenberg (curl),10,0,ok`, 10 articles stored
