import { loadSources } from "../sources.js";
import { getDataDir, ensureDataDir, loadArticles } from "../store.js";
import { printObject, formatTimestamp } from "../format.js";

export async function statusCommand(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const dataDir = getDataDir(getFlagValue(args, "--data-dir"));
  const sourcesPath = getFlagValue(args, "--sources");

  ensureDataDir(dataDir);

  const sources = loadSources(sourcesPath);
  const articles = await loadArticles(dataDir);

  const lastIngestion =
    articles.length > 0
      ? formatTimestamp(new Date(articles[articles.length - 1].ingested_at))
      : "never";

  const domains = new Set(articles.map((a) => a.domain));

  const data = {
    feeds: sources.length,
    articles: articles.length,
    unique_domains: domains.size,
    last_ingestion: lastIngestion,
    data_dir: dataDir,
  };

  printObject({
    entries: data,
    help: [
      `Run \`momentum ingest\` to fetch new articles`,
      `Run \`momentum sources\` to see configured feeds`,
      `Run \`momentum articles\` to browse articles`,
    ],
    json,
    jsonData: json ? data : undefined,
  });
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}
