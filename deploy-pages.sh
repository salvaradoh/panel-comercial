#!/bin/bash
# Build y deploy a GitHub Pages — repo: salvaradoh/panel-comercial
# URL pública: https://salvaradoh.github.io/panel-comercial/
set -e

REPO_URL="https://github.com/salvaradoh/panel-comercial.git"
DEPLOY_DIR="/tmp/panel-comercial-deploy"

echo "=== Building Panel Comercial ==="
VITE_BASE_URL="/panel-comercial/" npm run build

echo "=== Preparando deploy a gh-pages ==="
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r dist/. "$DEPLOY_DIR/"

# Necesario para que GitHub Pages sirva rutas de React (SPA)
cp "$DEPLOY_DIR/index.html" "$DEPLOY_DIR/404.html"

cd "$DEPLOY_DIR"
git init
git checkout -b gh-pages
git add -A
git commit -m "Deploy Panel Comercial"
git remote add origin "$REPO_URL"
git push --force origin gh-pages

echo "=== Deploy completo ==="
echo "URL: https://salvaradoh.github.io/panel-comercial/"
