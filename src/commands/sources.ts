import { loadSources, saveSources, addSource, type Source } from "../sources.js";
import { printList, printObject, exitWithError } from "../format.js";

export function sourcesCommand(args: string[]): void {
  const json = args.includes("--json");
  const sourcesPath = getFlagValue(args, "--sources");
  const addUrl = getFlagValue(args, "--add");

  if (addUrl) {
    handleAdd(addUrl, sourcesPath);
    return;
  }

  const sources = loadSources(sourcesPath);

  const rows = sources.map((s) => [
    s.name,
    s.domain,
    String(s.tier),
    s.rss_url,
  ]);

  printList({
    name: "sources",
    fields: ["name", "domain", "tier", "rss_url"],
    rows,
    help: [
      `Run \`momentum ingest\` to fetch articles from all feeds`,
      `Run \`momentum sources --add <rss_url>\` to add a new feed`,
    ],
    json,
    jsonData: json ? loadSources(sourcesPath) : undefined,
  });
}

function handleAdd(url: string, sourcesPath?: string): void {
  try {
    new URL(url);
  } catch {
    exitWithError({
      message: "Invalid URL",
      detail: url,
      help: ["Provide a valid RSS feed URL, e.g. https://example.com/feed/"],
    });
  }

  const sources = loadSources(sourcesPath);
  try {
    const newSource = addSource(sources, url);
    saveSources(sources, sourcesPath);
    printObject({
      entries: {
        added: newSource.name,
        domain: newSource.domain,
        tier: newSource.tier,
        rss_url: newSource.rss_url,
      },
      help: [
        `Run \`momentum ingest\` to fetch articles from the new feed`,
        `Edit sources.json to change the name, tier, or category_bias`,
      ],
      json: false,
    });
  } catch (err) {
    exitWithError({
      message: err instanceof Error ? err.message : String(err),
      help: ["Use a different URL or remove the existing source first"],
    });
  }
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}
