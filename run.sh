#!/usr/bin/env bash
#
# run.sh — everything you can check on a Mac without installing anything heavy.
#
#   ./run.sh              checks, engine tests, then serves the demo and opens it
#   ./run.sh test         just the tests, no browser, no server
#   ./run.sh figure       regenerate the static figures from the constructions
#   ./run.sh deps         create .venv and install the two Python packages
#   ./run.sh site         build the whole site and serve it (needs latexml)
#   ./run.sh open         serve whatever is already in out/, no build
#   ./run.sh doctor       report what's installed and what's missing
#
# Python packages go in a project-local .venv, never into the system or
# Homebrew Python — modern macOS Python refuses `pip install` into itself
# (PEP 668) and it is the wrong place for them anyway.
#
# Written for the bash that ships with macOS (3.2), so no fancy syntax.

set -u
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
VENV=".venv"

# Prefer the project venv if it exists; fall back to system python3 for the
# steps (tests, demo server) that need no packages at all.
if [ -x "$VENV/bin/python3" ]; then PY="$VENV/bin/python3"; else PY="python3"; fi
bold=$(printf '\033[1m'); dim=$(printf '\033[2m'); red=$(printf '\033[31m')
grn=$(printf '\033[32m'); ylw=$(printf '\033[33m'); off=$(printf '\033[0m')

say()  { printf '\n%s==>%s %s%s\n' "$bold" "$off" "$bold" "$1$off"; }
ok()   { printf '  %s✓%s %s\n' "$grn" "$off" "$1"; }
warn() { printf '  %s!%s %s\n' "$ylw" "$off" "$1"; }
bad()  { printf '  %s✗%s %s\n' "$red" "$off" "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ----------------------------------------------------------------- doctor

node_ok=0; py_ok=0; latexml_ok=0; pydeps_ok=0

doctor() {
  say "Environment"

  if have node; then
    v=$(node -p 'process.versions.node.split(".")[0]')
    if [ "$v" -ge 18 ]; then ok "node $(node -v)"; node_ok=1
    else bad "node $(node -v) is too old; need 18+  →  brew install node"; fi
  else
    bad "node is missing  →  brew install node"
  fi

  if have python3; then ok "python3 $(python3 -V 2>&1 | cut -d' ' -f2)"; py_ok=1
  else bad "python3 is missing  →  it ships with macOS; try xcode-select --install"; fi

  if [ -x "$VENV/bin/python3" ]; then ok "venv at $VENV/"
  else warn "no venv yet  →  ./run.sh deps        (only needed for 'site')"; fi

  if [ "$py_ok" = 1 ] && "$PY" -c 'import jinja2, lxml' >/dev/null 2>&1; then
    ok "python packages (jinja2, lxml) in $($PY -c 'import sys;print(sys.prefix)')"; pydeps_ok=1
  else
    warn "python packages missing  →  ./run.sh deps  (only needed for 'site')"
  fi

  if have latexml && have latexmlpost; then ok "latexml $(latexml --VERSION 2>&1 | head -1)"; latexml_ok=1
  else warn "latexml missing  →  brew install latexml        (only needed for 'site')"; fi

  if have latexmk; then ok "latexmk (PDF builds available)"
  else warn "latexmk missing  →  optional, only for 'make pdf'"; fi
}

need_node() {
  if [ "$node_ok" != 1 ]; then
    bad "node 18+ is required for this step. Install it and run again."
    exit 1
  fi
}

# ------------------------------------------------------------------ tests

run_tests() {
  need_node
  say "Degree engine — worked examples from the notes"
  if node site/static/mmp/test.mjs; then :; else bad "engine tests failed"; exit 1; fi

  say "Every published construction, and whether its claim still holds"
  if node site/static/mmp/verify.mjs applets/*.mmp; then :; else bad "a construction failed"; exit 1; fi
}

# ---------------------------------------------------------------- figures

run_figures() {
  need_node
  say "Rendering static figures from the constructions"
  for f in applets/*.mmp; do
    name=$(basename "$f" .mmp)
    node tools/figure.mjs "$f" "figs/$name.svg"
  done
  warn "These are SVG. LaTeXML reads them directly; pdflatex wants a PNG or PDF"
  warn "of the same name, so drop your own figs/<name>.png in for the PDF build."
}

# ------------------------------------------------------------------- deps

run_deps() {
  say "Python environment"
  if [ ! -x "$VENV/bin/python3" ]; then
    printf '  creating %s\n' "$VENV"
    python3 -m venv "$VENV" || { bad "could not create the venv"; exit 1; }
  fi
  "$VENV/bin/python3" -m pip install --quiet --upgrade pip
  "$VENV/bin/python3" -m pip install --quiet -r requirements.txt || {
    bad "install failed"; exit 1; }
  ok "installed into $VENV/"
  "$VENV/bin/python3" -m pip list --format=columns | sed 's/^/    /'
  printf '\n  %sNothing was installed into your system Python.%s\n' "$dim" "$off"
  printf '  %sDelete %s to undo all of it.%s\n' "$dim" "$VENV" "$off"
  if ! have latexml; then
    printf '\n'
    warn "latexml is separate and not a Python package  →  brew install latexml"
  fi
}

# ------------------------------------------------------------------- site

run_site() {
  if [ "$latexml_ok" != 1 ] || [ "$pydeps_ok" != 1 ]; then
    say "Building the site from LaTeX"
    [ "$latexml_ok" != 1 ] && bad "latexml missing  →  brew install latexml"
    [ "$pydeps_ok" != 1 ] && bad "python packages missing  →  ./run.sh deps"
    if [ -f "out/index.html" ]; then
      printf '\n'
      warn "A prebuilt site is already in out/, so you can look at it now:"
      warn "    ./run.sh open"
      warn "You only need latexml once you start editing the LaTeX."
    fi
    exit 1
  fi
  say "Building the site from LaTeX"
  "$PY" site/build.py || { bad "build failed"; exit 1; }
  serve_dir out "" "the full site"
}

open_site() {
  if [ ! -f "out/index.html" ]; then
    bad "nothing in out/ yet  →  ./run.sh site"
    exit 1
  fi
  say "Serving the prebuilt site"
  serve_dir out "" "the full site"
}

# ------------------------------------------------------------------ serve

# serve_dir <directory> <path> <description>
serve_dir() {
  dir="$1"; path="$2"; what="$3"
  while lsof -i ":$PORT" >/dev/null 2>&1; do PORT=$((PORT + 1)); done
  url="http://localhost:$PORT/$path"
  ( cd "$dir" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &   # stdlib only
  server=$!
  trap 'kill $server 2>/dev/null; printf "\n  stopped\n"; exit 0' INT TERM
  sleep 1
  printf '\n  %s%s%s   %s\n' "$bold" "$url" "$off" "$what"
  if [ "$dir" = "out" ]; then
    printf '  %sBoth books, with the sidebar, the pager, and the figure applet.%s\n' "$dim" "$off"
    printf '  %sOn “Constructing new objects”, the link at the end of the proof%s\n' "$dim" "$off"
    printf '  %sopens the rigorous book beside it — that is the split view.%s\n' "$dim" "$off"
  else
    printf '  %sTwo live figures: the Gergonne animation and the Euler line.%s\n' "$dim" "$off"
    printf '  %sDrag the sliders, fill in the degrees, press Check.%s\n' "$dim" "$off"
    printf '  %sExpected for the first: BC 2, B 1, C 1, AD 2, BE 1, CF 1.%s\n' "$dim" "$off"
  fi
  printf '\n  %sCtrl-C to stop.%s\n\n' "$dim" "$off"
  have open && open "$url"
  wait $server
}

serve() { need_node; say "Serving the demo"; serve_dir site/static "mmp/demo.html" "the applet demo"; }

# ------------------------------------------------------------------- main

case "${1:-all}" in
  doctor)  doctor ;;
  deps)    doctor; run_deps ;;
  test)    doctor; run_tests ;;
  figure)  doctor; run_figures ;;
  site)    doctor; run_site ;;
  open)    doctor; open_site ;;
  serve)   doctor; serve ;;
  all)     doctor; run_tests; serve ;;
  *)       printf 'usage: ./run.sh [doctor|deps|test|figure|serve|open|site]\n'; exit 2 ;;
esac
