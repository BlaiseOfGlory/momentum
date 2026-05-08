import { mkdirSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export interface Article {
  id: string;
  url: string;
  title: string;
  domain: string;
  source_name: string;
  source_tier: number;
  ingested_at: string; // ISO 8601
  origin: "rss" | "discord";
  event_id: string | null;
}

const ARTICLES_FILE = "articles.jsonl";

// ---------------------------------------------------------------------------
// Data directory
// ---------------------------------------------------------------------------

/**
 * Return the data directory path. Uses customDir if provided,
 * otherwise defaults to $HOME/.local/share/momentum/.
 */
export function getDataDir(customDir?: string): string {
  if (customDir) return customDir;

  const home = process.env.HOME;
  if (!home) {
    throw new Error(
      "HOME environment variable is not set — cannot determine default data directory",
    );
  }
  return join(home, ".local", "share", "momentum");
}

/**
 * Create the data directory recursively if it does not exist.
 */
export function ensureDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * Read all articles from articles.jsonl. Returns empty array if the file
 * does not exist. Skips malformed lines with a stderr warning rather than
 * crashing the entire load.
 */
export async function loadArticles(dataDir: string): Promise<Article[]> {
  const filePath = join(dataDir, ARTICLES_FILE);

  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];

  const articles: Article[] = [];
  const lines = raw.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (isArticle(parsed)) {
        articles.push(parsed as unknown as Article);
      } else {
        console.error(
          `[store] Skipping malformed article at line ${i + 1}: missing required fields`,
        );
      }
    } catch {
      console.error(
        `[store] Skipping unparseable JSON at line ${i + 1} in ${filePath}`,
      );
    }
  }

  return articles;
}

/**
 * Load only the set of normalized URLs from the existing articles file.
 * More memory-efficient than loading full Article objects when all you
 * need is dedup checking.
 */
export async function loadUrlSet(dataDir: string): Promise<Set<string>> {
  const filePath = join(dataDir, ARTICLES_FILE);
  const urls = new Set<string>();

  if (!existsSync(filePath)) return urls;

  const raw = readFileSync(filePath, "utf-8");
  if (!raw.trim()) return urls;

  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof parsed.url === "string") {
        urls.add(normalizeUrl(parsed.url));
      }
    } catch {
      // Skip unparseable lines silently — loadArticles logs warnings
    }
  }

  return urls;
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a URL for deduplication:
 * 1. Lowercase the hostname
 * 2. Strip trailing slashes from the path
 * 3. Remove utm_* query parameters
 * 4. Remove URL fragments (#...)
 * 5. Remove empty query string if all params were stripped
 */
export function normalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // If the URL is malformed, return it lowercased as-is — better than crashing
    return url.toLowerCase().replace(/\/+$/, "");
  }

  // Lowercase hostname (URL constructor already does this, but be explicit)
  parsed.hostname = parsed.hostname.toLowerCase();

  // Strip trailing slashes from pathname
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  // Remove utm_* query params
  const params = new URLSearchParams(parsed.search);
  const keysToDelete: string[] = [];
  for (const key of params.keys()) {
    if (key.toLowerCase().startsWith("utm_")) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    params.delete(key);
  }

  // Rebuild search — empty if no params remain
  const remaining = params.toString();
  parsed.search = remaining ? `?${remaining}` : "";

  // Remove fragment
  parsed.hash = "";

  return parsed.toString();
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

/**
 * Append new articles to the JSONL file, skipping any whose normalized URL
 * already exists in the store. Returns the count of articles actually written.
 */
export async function appendArticles(
  dataDir: string,
  articles: Article[],
): Promise<number> {
  if (articles.length === 0) return 0;

  ensureDataDir(dataDir);

  const existingUrls = await loadUrlSet(dataDir);
  const filePath = join(dataDir, ARTICLES_FILE);
  let written = 0;

  // Build the full batch to write in one append call for atomicity
  const lines: string[] = [];
  for (const article of articles) {
    const normalized = normalizeUrl(article.url);
    if (existingUrls.has(normalized)) continue;

    // Add to in-memory set to handle duplicates within the same batch
    existingUrls.add(normalized);
    lines.push(JSON.stringify(article));
    written++;
  }

  if (lines.length > 0) {
    appendFileSync(filePath, lines.join("\n") + "\n", "utf-8");
  }

  return written;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a sortable unique ID: base-36 timestamp + 4 random hex chars.
 * No external dependencies. Collision probability is negligible for
 * single-process sequential ingestion.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `${timestamp}-${random}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal shape check for Article objects loaded from JSONL.
 * Validates required fields exist with correct types.
 */
function isArticle(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.id === "string" &&
    typeof obj.url === "string" &&
    typeof obj.title === "string" &&
    typeof obj.domain === "string" &&
    typeof obj.source_name === "string" &&
    typeof obj.source_tier === "number" &&
    typeof obj.ingested_at === "string" &&
    (obj.origin === "rss" || obj.origin === "discord") &&
    (obj.event_id === null || typeof obj.event_id === "string")
  );
}
