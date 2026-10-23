#!/usr/bin/env bash
# momentum scheduled ingest — invoked by cron.
# Cron runs with a minimal PATH and won't find `bun` (momentum is a `#!/usr/bin/env bun`
# script), so we set PATH explicitly here. Logs one summary line per run.
#   Schedule:  crontab -l
#   Log:       ~/.local/share/momentum/cron.log
set -uo pipefail

export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin"
LOG="$HOME/.local/share/momentum/cron.log"
mkdir -p "$(dirname "$LOG")"

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') : momentum ingest ====="
  out="$(momentum ingest 2>&1)"; rc=$?
  echo "$out" | grep -E '^total:' || echo "(no total line printed)"
  [ "$rc" -ne 0 ] && { echo "--- FAILED, full output tail: ---"; echo "$out" | tail -20; }
  echo "exit=$rc"
} >> "$LOG" 2>&1
