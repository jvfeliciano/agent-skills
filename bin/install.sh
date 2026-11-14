#!/usr/bin/env bash
set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

die() {
  echo "ERROR: $1" >&2
  [ -n "${2:-}" ] && echo "Example: $2" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: install.sh --target <antigravity|cursor|claude|copilot|all> --scope <workspace|global> [--workspace <path>]

Options:
  --target <name>     Target harness: antigravity, cursor, claude, copilot, or all (default: antigravity)
  --scope <scope>     Installation scope: workspace or global (default: workspace)
  --workspace <path>  Workspace root path when --scope workspace (default: .)

Examples:
  ./agent-skills/bin/install.sh --target antigravity --scope global
  ./agent-skills/bin/install.sh --target copilot --scope workspace --workspace .
  ./agent-skills/bin/install.sh --target all --scope workspace --workspace .
EOF
}

TARGET="antigravity"
SCOPE="workspace"
WORKSPACE="."

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --target) TARGET="${2:-}"; shift 2 || die "Missing --target value" "install.sh --target antigravity --scope global" ;;
    --scope) SCOPE="${2:-}"; shift 2 || die "Missing --scope value" "install.sh --target antigravity --scope global" ;;
    --workspace) WORKSPACE="${2:-}"; shift 2 || die "Missing --workspace value" "install.sh --target all --scope workspace --workspace ." ;;
    *) die "Unknown flag '$1'" "install.sh --help" ;;
  esac
done

case "$TARGET" in antigravity|cursor|claude|copilot|all) ;; *) die "Invalid --target '$TARGET'" "install.sh --target all --scope workspace" ;; esac
case "$SCOPE" in workspace|global) ;; *) die "Invalid --scope '$SCOPE'" "install.sh --target antigravity --scope global" ;; esac

link_dir() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  if [ -L "$dst" ] || [ ! -e "$dst" ]; then
    ln -sfn "$src" "$dst"
    echo "Linked: $dst -> $src"
  else
    echo "Skipped (existing non-symlink): $dst"
  fi
}

install_antigravity() {
  if [ "$SCOPE" = "global" ]; then
    link_dir "$ROOT_DIR" "$HOME/.gemini/config/plugins/agent-skills"
    link_dir "$ROOT_DIR/bin/agx" "$HOME/.local/bin/agx"
  else
    local ws_abs rel_parent plug_name rel_skills
    ws_abs="$(cd "$WORKSPACE" && pwd)"
    plug_name="$(basename "$ROOT_DIR")"
    rel_parent="$(node -e "import('node:path').then(p=>console.log(p.relative(process.argv[1], p.dirname(process.argv[2])) || '.'))" "$ws_abs" "$ROOT_DIR")"
    rel_skills="$(node -e "import('node:path').then(p=>console.log(p.relative(process.argv[1], process.argv[2]) || '.'))" "$ws_abs" "$ROOT_DIR/skills")"
    mkdir -p "$ws_abs/.agents/state"
    cat > "$ws_abs/.agents/plugins.json" <<EOF
{
  "entries": [
    {
      "path": "$rel_parent",
      "include_only": ["$plug_name"]
    }
  ]
}
EOF
    cat > "$ws_abs/.agents/skills.json" <<EOF
{
  "entries": [
    { "path": "$rel_skills" }
  ]
}
EOF
    echo "Configured workspace Antigravity manifests in $ws_abs/.agents/"
  fi
}

link_agents() {
  local dest="$1"
  mkdir -p "$dest"
  for a in "$ROOT_DIR/agents/"*.md; do
    [ -f "$a" ] && link_dir "$a" "$dest/$(basename "$a")"
  done
}

install_cursor() {
  if [ "$SCOPE" = "global" ]; then
    mkdir -p "$HOME/.cursor/skills"
    for s in "$ROOT_DIR/skills/"*; do
      [ -d "$s" ] && link_dir "$s" "$HOME/.cursor/skills/$(basename "$s")"
    done
    link_agents "$HOME/.cursor/agents"
  else
    local ws_abs
    ws_abs="$(cd "$WORKSPACE" && pwd)"
    mkdir -p "$ws_abs/.cursor/rules" "$ws_abs/.cursor/skills"
    link_dir "$ROOT_DIR/rules/AGENTS.md" "$ws_abs/.cursor/rules/agent-skills.md"
    for s in "$ROOT_DIR/skills/"*; do
      [ -d "$s" ] && link_dir "$s" "$ws_abs/.cursor/skills/$(basename "$s")"
    done
    link_agents "$ws_abs/.cursor/agents"
  fi
}

install_claude() {
  local base_dir
  if [ "$SCOPE" = "global" ]; then
    base_dir="$HOME/.claude"
  else
    base_dir="$(cd "$WORKSPACE" && pwd)/.claude"
  fi
  mkdir -p "$base_dir/skills"
  for s in "$ROOT_DIR/skills/"*; do
    [ -d "$s" ] && link_dir "$s" "$base_dir/skills/$(basename "$s")"
  done
  link_agents "$base_dir/agents"
  link_dir "$ROOT_DIR/rules/AGENTS.md" "$base_dir/agent-skills-rules.md"
}

install_copilot() {
  local base_dir
  if [ "$SCOPE" = "global" ]; then
    base_dir="$HOME/.copilot"
  else
    base_dir="$(cd "$WORKSPACE" && pwd)/.github"
  fi
  mkdir -p "$base_dir/skills"
  for s in "$ROOT_DIR/skills/"*; do
    [ -d "$s" ] && link_dir "$s" "$base_dir/skills/$(basename "$s")"
  done
  link_agents "$base_dir/agents"
  link_dir "$ROOT_DIR/rules/AGENTS.md" "$base_dir/copilot-instructions.md"
}

if [ "$TARGET" = "antigravity" ] || [ "$TARGET" = "all" ]; then install_antigravity; fi
if [ "$TARGET" = "cursor" ] || [ "$TARGET" = "all" ]; then install_cursor; fi
if [ "$TARGET" = "claude" ] || [ "$TARGET" = "all" ]; then install_claude; fi
if [ "$TARGET" = "copilot" ] || [ "$TARGET" = "all" ]; then install_copilot; fi
exit 0
