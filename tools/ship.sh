#!/bin/sh
# Rebuild, push to GitHub Pages, and copy the source for the Claude artifact republish.
set -e
cd "$(dirname "$0")/.."
node tools/build.js
cp source.html /tmp/claude-0/-home-user/467cb7a2-6980-5e04-9ac5-fe15d57a52b7/scratchpad/ufc/ufc334.html
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "${1:-Update results}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BanJLJeG9E3vjkTfgSDxix" || true
git -c push.negotiate=true push -q origin main
