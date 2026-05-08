import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export interface Source {
  name: string;
  domain: string;
  rss_url: string;
  tier: 1 | 2 | 3;
  category_bias: string[];
}

const CONFIG_DIR = join(homedir(), ".config", "momentum");
const BUNDLED_SOURCES_PATH = join(dirname(dirname(import.meta.path)), "sources.json");

/**
 * Resolve sources.json path. Priority:
 *   1. --sources flag (explicit path)
 *   2. ~/.config/momentum/sources.json (user config)
 *   3. Bundled sources.json in the repo
 *
 * On first run, copies the bundled sources.json to ~/.config/momentum/
 * so the user has a local copy to edit.
 */
function resolveSourcesPath(customPath?: string): string {
  if (customPath) return customPath;

  const configPath = join(CONFIG_DIR, "sources.json");
  if (existsSync(configPath)) return configPath;

  if (existsSync(BUNDLED_SOURCES_PATH)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    copyFileSync(BUNDLED_SOURCES_PATH, configPath);
    return configPath;
  }

  throw new Error(
    `No sources.json found. Checked: ${configPath}, ${BUNDLED_SOURCES_PATH}`
  );
}

export function loadSources(customPath?: string): Source[] {
  const sourcesPath = resolveSourcesPath(customPath);
  const content = readFileSync(sourcesPath, "utf-8");
  return JSON.parse(content) as Source[];
}

export function saveSources(sources: Source[], customPath?: string): void {
  const sourcesPath = resolveSourcesPath(customPath);
  writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + "\n", "utf-8");
}

export function addSource(sources: Source[], url: string): Source {
  const parsed = new URL(url);
  const domain = parsed.hostname.replace(/^www\./, "");
  const existing = sources.find((s) => s.domain === domain);
  if (existing) {
    throw new Error(`Source already exists: ${existing.name} (${domain})`);
  }

  const newSource: Source = {
    name: domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1),
    domain,
    rss_url: url,
    tier: 3,
    category_bias: [],
  };
  sources.push(newSource);
  return newSource;
}
