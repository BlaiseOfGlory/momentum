import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

export interface WatchlistSource {
  name: string;
  url: string;
  domain: string;
  tier: number;
  category_bias: string[];
  link_pattern: string;
}

export interface WatchlistItem {
  title: string;
  url: string;
}

export interface WatchlistResult {
  items: WatchlistItem[];
  error?: string;
}

const DEFAULT_WATCHLIST = "watchlist.json";

export function loadWatchlist(customPath?: string): WatchlistSource[] {
  const filePath = customPath ?? resolveWatchlistPath();
  if (!existsSync(filePath)) return [];

  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`watchlist.json must be a JSON array`);
  }

  return parsed as WatchlistSource[];
}

export async function fetchWatchlistPage(
  source: WatchlistSource,
  timeoutMs = 10_000,
): Promise<WatchlistResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Momentum/1.0 (security-news-aggregator)",
      },
    });

    if (!resp.ok) {
      return { items: [], error: `HTTP ${resp.status}` };
    }

    const html = await resp.text();
    return { items: extractLinks(html, source) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { items: [], error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function extractLinks(html: string, source: WatchlistSource): WatchlistItem[] {
  const items: WatchlistItem[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1];
    const rawText = match[2].replace(/<[^>]+>/g, "").trim();

    if (!rawHref || !rawText) continue;
    if (!rawHref.includes(source.link_pattern)) continue;

    // Skip navigation/index links (the blog index page itself)
    if (rawHref === source.url) continue;
    if (rawHref.replace(/\/$/, "") === source.url.replace(/\/$/, "")) continue;

    const fullUrl = resolveUrl(rawHref, source.url);
    if (!fullUrl) continue;

    const normalized = fullUrl.replace(/\/$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    items.push({ title: rawText, url: fullUrl });
  }

  return items;
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function resolveWatchlistPath(): string {
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  return join(scriptDir, "..", DEFAULT_WATCHLIST);
}
