#!/bin/bash
# Build y deploy a GitHub Pages
# Requiere: gh CLI autenticado, o git push a rama gh-pages
set -e

echo "=== Building frontend for GitHub Pages ==="
VITE_BASE_URL="/dashboard-v2/" npm run build

echo "=== Deploying dist/ to gh-pages branch ==="
# Opción A: usando gh CLI + worktree (sin instalar extra)
git worktree add /tmp/gh-pages-deploy gh-pages 2>/dev/null || true
cp -r dist/* /tmp/gh-pages-deploy/
cd /tmp/gh-pages-deploy
git add -A
git commit -m "Deploy dashboard-v2 to GitHub Pages"
git push origin gh-pages
cd -
git worktree remove /tmp/gh-pages-deploy

echo "=== Deploy completo. Ver: https://<usuario>.github.io/dashboard-v2/ ==="
