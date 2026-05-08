import { getDataDir, loadArticles, type Article } from "../store.js";
import { printList, printEmpty, sanitizeToon, formatTimestamp } from "../format.js";

export async function articlesCommand(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const dataDir = getDataDir(getFlagValue(args, "--data-dir"));
  const limitStr = getFlagValue(args, "--limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 25;

  const articles = await loadArticles(dataDir);

  if (articles.length === 0) {
    printEmpty("articles", [
      `Run \`momentum ingest\` to fetch articles from RSS feeds`,
    ]);
    return;
  }

  const recent = articles.slice(-limit).reverse();

  const rows = recent.map((a) => [
    sanitizeToon(a.title.slice(0, 80)),
    a.domain,
    `T${a.source_tier}`,
    formatTimestamp(new Date(a.ingested_at)),
  ]);

  printList({
    name: "articles",
    fields: ["title", "domain", "tier", "ingested"],
    rows,
    help: [
      `Run \`momentum articles --limit 50\` to see more`,
      `Run \`momentum articles --json\` for full article data`,
    ],
    json,
    jsonData: json ? recent : undefined,
  });
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}
