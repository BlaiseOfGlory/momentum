const MAX_OUTPUT_BYTES = 2048;

export interface ToonListOptions {
  name: string;
  fields: string[];
  rows: string[][];
  help: string[];
  json: boolean;
  jsonData?: unknown;
}

export interface ToonObjectOptions {
  entries: Record<string, string | number>;
  help: string[];
  json: boolean;
  jsonData?: unknown;
}

export function printList(opts: ToonListOptions): void {
  if (opts.json && opts.jsonData !== undefined) {
    console.log(JSON.stringify(opts.jsonData, null, 2));
    return;
  }

  const count = opts.rows.length;
  const header = `${opts.name}[${count}]{${opts.fields.join(",")}}:`;
  const lines: string[] = [header];

  for (const row of opts.rows) {
    lines.push(`  ${row.join(",")}`);
  }

  const helpBlock = formatHelp(opts.help);
  if (helpBlock) lines.push(helpBlock);

  const output = lines.join("\n");
  printWithSizeHint(output);
}

export function printObject(opts: ToonObjectOptions): void {
  if (opts.json && opts.jsonData !== undefined) {
    console.log(JSON.stringify(opts.jsonData, null, 2));
    return;
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(opts.entries)) {
    lines.push(`${key}: ${value}`);
  }

  const helpBlock = formatHelp(opts.help);
  if (helpBlock) lines.push(helpBlock);

  const output = lines.join("\n");
  printWithSizeHint(output);
}

export function printEmpty(name: string, help: string[]): void {
  const lines = [`${name}[0]: no results`];
  const helpBlock = formatHelp(help);
  if (helpBlock) lines.push(helpBlock);
  console.log(lines.join("\n"));
}

export function formatHelp(suggestions: string[]): string {
  if (suggestions.length === 0) return "";
  const lines = [`help[${suggestions.length}]:`];
  for (const s of suggestions) {
    lines.push(`  ${s}`);
  }
  return lines.join("\n");
}

export function sanitizeToon(text: string): string {
  return text.replace(/\n/g, " ").replace(/,/g, ";");
}

function printWithSizeHint(output: string): void {
  const byteLength = Buffer.byteLength(output, "utf-8");
  if (byteLength > MAX_OUTPUT_BYTES) {
    console.log(output);
    console.log(`[output: ${byteLength} bytes]`);
  } else {
    console.log(output);
  }
}

export interface ErrorOptions {
  message: string;
  detail?: string;
  help?: string[];
}

export function exitWithError(opts: ErrorOptions): never {
  const lines = [`error: ${opts.message}`];
  if (opts.detail) {
    lines.push(`detail: ${opts.detail}`);
  }
  if (opts.help && opts.help.length > 0) {
    for (let i = 0; i < opts.help.length; i++) {
      lines.push(`help[${i + 1}]: ${opts.help[i]}`);
    }
  }
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(1);
}

export function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}
