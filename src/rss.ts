import { XMLParser } from "fast-xml-parser";

export interface FeedItem {
  title: string;
  url: string;
  pubDate: string; // ISO 8601
}

export interface FeedResult {
  source: string;
  items: FeedItem[];
  error?: string;
}

const USER_AGENT = "Momentum/1.0 (security-news-aggregator)";
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch and parse an RSS 2.0 or Atom feed, returning normalized FeedItems.
 * On any failure (network, parse, malformed XML), returns FeedResult with
 * empty items and an error string — never throws.
 */
export async function fetchFeed(
  url: string,
  sourceName: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FeedResult> {
  const empty: FeedResult = { source: sourceName, items: [] };

  // --- Fetch with bounded timeout ---
  let responseText: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        ...empty,
        error: `HTTP ${response.status} ${response.statusText} from ${url}`,
      };
    }

    responseText = await response.text();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { ...empty, error: `Fetch failed for ${url}: ${message}` };
  }

  // --- Parse XML ---
  let parsed: Record<string, unknown>;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      // Ensure single-element arrays stay arrays for consistent iteration.
      // In fast-xml-parser v5 the second arg is JPathOrMatcher (string | MatcherView).
      // We coerce to string for our simple jpath checks.
      isArray: (_name, jpath) => {
        const jp = String(jpath);
        return (
          jp === "rss.channel.item" ||
          jp === "feed.entry" ||
          jp === "feed.entry.link"
        );
      },
    });
    parsed = parser.parse(responseText) as Record<string, unknown>;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { ...empty, error: `XML parse failed for ${url}: ${message}` };
  }

  // --- Detect format and extract items ---
  try {
    if (isAtomFeed(parsed)) {
      return { source: sourceName, items: parseAtom(parsed) };
    }
    if (isRssFeed(parsed)) {
      return { source: sourceName, items: parseRss(parsed) };
    }
    return { ...empty, error: `Unrecognized feed format from ${url}` };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    return {
      ...empty,
      error: `Item extraction failed for ${url}: ${message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

function isAtomFeed(parsed: Record<string, unknown>): boolean {
  return typeof parsed === "object" && parsed !== null && "feed" in parsed;
}

function isRssFeed(parsed: Record<string, unknown>): boolean {
  if (typeof parsed !== "object" || parsed === null) return false;
  if ("rss" in parsed) return true;
  // Some feeds omit the <rss> wrapper and expose <channel> directly
  if ("channel" in parsed) return true;
  return false;
}

// ---------------------------------------------------------------------------
// RSS 2.0 parsing
// ---------------------------------------------------------------------------

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  "dc:date"?: unknown;
}

function parseRss(parsed: Record<string, unknown>): FeedItem[] {
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = (rss?.channel ?? parsed.channel) as
    | Record<string, unknown>
    | undefined;
  if (!channel) return [];

  const rawItems = channel.item;
  if (!rawItems) return [];

  const items: RssItem[] = Array.isArray(rawItems)
    ? (rawItems as RssItem[])
    : [rawItems as RssItem];

  const results: FeedItem[] = [];
  for (const item of items) {
    const title = stringOrEmpty(item.title);
    const url = stringOrEmpty(item.link);
    if (!title || !url) continue;

    const rawDate = stringOrEmpty(item.pubDate) || stringOrEmpty(item["dc:date"]);
    const pubDate = normalizeDate(rawDate);

    results.push({ title, url, pubDate });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Atom parsing
// ---------------------------------------------------------------------------

interface AtomLink {
  "@_href"?: string;
  "@_rel"?: string;
}

interface AtomEntry {
  title?: unknown;
  link?: unknown;
  published?: unknown;
  updated?: unknown;
}

function parseAtom(parsed: Record<string, unknown>): FeedItem[] {
  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (!feed) return [];

  const rawEntries = feed.entry;
  if (!rawEntries) return [];

  const entries: AtomEntry[] = Array.isArray(rawEntries)
    ? (rawEntries as AtomEntry[])
    : [rawEntries as AtomEntry];

  const results: FeedItem[] = [];
  for (const entry of entries) {
    const title = extractAtomTitle(entry.title);
    const url = extractAtomLink(entry.link);
    if (!title || !url) continue;

    const rawDate =
      stringOrEmpty(entry.published) || stringOrEmpty(entry.updated);
    const pubDate = normalizeDate(rawDate);

    results.push({ title, url, pubDate });
  }
  return results;
}

/**
 * Atom <title> can be a plain string or an object with #text when
 * type attributes are present (e.g. type="html").
 */
function extractAtomTitle(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw !== null && "#text" in raw) {
    return String((raw as Record<string, unknown>)["#text"]).trim();
  }
  return "";
}

/**
 * Extract the best link from Atom <link> element(s).
 * Prefers rel="alternate"; falls back to the first link with an href.
 */
function extractAtomLink(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();

  const links: AtomLink[] = Array.isArray(raw)
    ? (raw as AtomLink[])
    : raw && typeof raw === "object"
      ? [raw as AtomLink]
      : [];

  // First pass: look for rel="alternate"
  for (const link of links) {
    if (link["@_rel"] === "alternate" && link["@_href"]) {
      return link["@_href"];
    }
  }
  // Second pass: first link with an href
  for (const link of links) {
    if (link["@_href"]) {
      return link["@_href"];
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Date normalization
// ---------------------------------------------------------------------------

/**
 * Attempt to normalize any date string to ISO 8601.
 * Returns empty string if unparseable — never throws.
 */
function normalizeDate(raw: string): string {
  if (!raw) return "";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Coerce unknown values to a trimmed string. Returns empty string for
 * null, undefined, objects, or anything non-stringifiable.
 */
function stringOrEmpty(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return decodeEntities(val.trim());
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (typeof val === "object" && "#text" in (val as Record<string, unknown>)) {
    return decodeEntities(String((val as Record<string, unknown>)["#text"]).trim());
  }
  return "";
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITY_MAP[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
