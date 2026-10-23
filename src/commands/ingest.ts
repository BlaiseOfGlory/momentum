import { loadSources, type Source } from "../sources.js";
import { fetchFeed, type FeedResult } from "../rss.js";
import {
  getDataDir,
  ensureDataDir,
  loadUrlSet,
  appendArticles,
  normalizeUrl,
  generateId,
  type Article,
} from "../store.js";
import { printList, printObject, formatHelp } from "../format.js";
import { loadWatchlist, fetchWatchlistPage } from "../watchlist.js";

export async function ingestCommand(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const sourcesPath = getFlagValue(args, "--sources");
  const dataDir = getDataDir(getFlagValue(args, "--data-dir"));

  ensureDataDir(dataDir);

  const sources = loadSources(sourcesPath);
  const existingUrls = await loadUrlSet(dataDir);

  const results = await Promise.allSettled(
    sources.map((source) => fetchFeed(source.rss_url, source.name))
  );

  let totalNew = 0;
  let totalSkipped = 0;
  const feedRows: string[][] = [];
  const allNewArticles: Article[] = [];
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const source = sources[i];
    const result = results[i];

    if (result.status === "rejected") {
      errors.push(`${source.name}: ${result.reason}`);
      feedRows.push([source.name, "0", "0", "error"]);
      continue;
    }

    const feedResult: FeedResult = result.value;
    if (feedResult.error) {
      errors.push(`${source.name}: ${feedResult.error}`);
      feedRows.push([source.name, "0", "0", "error"]);
      continue;
    }

    let newCount = 0;
    let skipCount = 0;

    for (const item of feedResult.items) {
      const normalized = normalizeUrl(item.url);
      if (existingUrls.has(normalized)) {
        skipCount++;
        continue;
      }

      existingUrls.add(normalized);
      const article: Article = {
        id: generateId(),
        url: item.url,
        title: item.title,
        domain: extractDomain(item.url),
        source_name: source.name,
        source_tier: source.tier,
        ingested_at: new Date().toISOString(),
        origin: "rss",
        event_id: null,
      };
      allNewArticles.push(article);
      newCount++;
    }

    feedRows.push([source.name, String(newCount), String(skipCount), "ok"]);
    totalNew += newCount;
    totalSkipped += skipCount;
  }

  // Watchlist: scrape no-RSS blog pages for new posts
  const watchlist = loadWatchlist();
  if (watchlist.length > 0) {
    const watchResults = await Promise.allSettled(
      watchlist.map((source) => fetchWatchlistPage(source))
    );

    for (let i = 0; i < watchResults.length; i++) {
      const source = watchlist[i];
      const result = watchResults[i];

      if (result.status === "rejected") {
        errors.push(`${source.name}: ${result.reason}`);
        feedRows.push([source.name, "0", "0", "error"]);
        continue;
      }

      const wr = result.value;
      if (wr.error) {
        errors.push(`${source.name}: ${wr.error}`);
        feedRows.push([source.name, "0", "0", "error"]);
        continue;
      }

      let newCount = 0;
      let skipCount = 0;

      for (const item of wr.items) {
        const normalized = normalizeUrl(item.url);
        if (existingUrls.has(normalized)) {
          skipCount++;
          continue;
        }

        existingUrls.add(normalized);
        const article: Article = {
          id: generateId(),
          url: item.url,
          title: item.title,
          domain: source.domain,
          source_name: source.name,
          source_tier: source.tier,
          ingested_at: new Date().toISOString(),
          origin: "watchlist",
          event_id: null,
        };
        allNewArticles.push(article);
        newCount++;
      }

      feedRows.push([source.name, String(newCount), String(skipCount), "ok"]);
      totalNew += newCount;
      totalSkipped += skipCount;
    }
  }

  if (allNewArticles.length > 0) {
    await appendArticles(dataDir, allNewArticles);
  }

  if (errors.length > 0) {
    for (const err of errors) {
      process.stderr.write(`warn: ${err}\n`);
    }
  }

  const help = [
    `Run \`momentum articles\` to see ingested articles`,
    `Run \`momentum sources\` to see configured feeds`,
  ];

  if (json) {
    console.log(
      JSON.stringify(
        {
          feeds: feedRows.map(([name, added, skipped, status]) => ({
            name,
            added: Number(added),
            skipped: Number(skipped),
            status,
          })),
          total_new: totalNew,
          total_skipped: totalSkipped,
          errors: errors.length,
        },
        null,
        2
      )
    );
    return;
  }

  printList({
    name: "ingest",
    fields: ["source", "new", "skipped", "status"],
    rows: feedRows,
    help,
    json: false,
  });

  console.log(`\ntotal: ${totalNew} new, ${totalSkipped} skipped, ${errors.length} errors`);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}
