# Deployment & Maintenance Setup — Fitness Tracker SPA (React + TypeScript + Vite)

Research date: 2026-08-28. Repo: https://github.com/kimmyap/Fitness-track (GitHub Pages base path must match the repo name: `/Fitness-track/`).

## 1. Hosting recommendation: GitHub Pages

| | GitHub Pages | Vercel (Hobby) | Netlify (Free) | Cloudflare (Pages / Workers) |
|---|---|---|---|---|
| Free tier | Free for public repos; ~100 GB/mo soft bandwidth, 1 GB site | $0, ~100 GB/mo, 100 deploys/day, non-commercial only | Credit-based since Sep 2025: 300 credits/mo hard cap; deploys cost 15 credits; sites pause at cap | Generous, but Pages is in maintenance mode — new projects pushed to Workers |
| SPA fallback | `index.html` → `404.html` workaround | Native | Native (`/_redirects`) | Native |
| Custom domain | Free, auto HTTPS | Free | Free | Free |
| Setup | Zero external accounts; first-party Actions | Connect repo | Connect repo | Needs wrangler config + token |

**Chosen: GitHub Pages** — source already on GitHub, no third-party accounts/tokens, first-party maintained actions, smallest maintenance surface. SPA deep-link weakness mitigated by the 404.html fallback (or hash routing).

## 2. GitHub Actions workflow (CI + deploy)

Verified action versions (2026-09-11): `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`.

> `deploy-pages` was bumped v4 → v5 on 2026-09-11: v4 targets Node.js 20, which GitHub has
> deprecated, so runners were force-running it on Node 24 and annotating every deploy. v5.0.0's
> headline change is exactly that Node 24 update — no input or output changes.
> `.github/workflows/ci-deploy.yml` is the authority if this doc ever lags again.

Required repo setting: **Settings → Pages → Source → "GitHub Actions"**.

`.github/workflows/ci-deploy.yml`:

```yaml
name: CI & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: false

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test:run

      - name: Build
        run: npm run build

      - name: Add SPA fallback (404.html)
        run: cp dist/index.html dist/404.html

      - name: Upload Pages artifact
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

Notes: full CI gate on every push/PR; only main-branch pushes deploy. OIDC-based deploy-pages@v5 — no PAT, no gh-pages branch. `npm ci` + setup-node npm cache. Node 24 pinned to match local dev.

## 3. Vite config for GitHub Pages

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Served at https://<user>.github.io/Fitness-track/
  base: '/Fitness-track/',
})
```

- SPA fallback: `cp dist/index.html dist/404.html` in CI makes deep links work (served with 404 status, renders fine). Alternative: hash routing (`createHashRouter`) needs no fallback.
- React Router browser history: pass `basename: import.meta.env.BASE_URL`.
- Asset URLs: reference via `import.meta.env.BASE_URL` or imports, never hardcoded `/foo.png`.
- Custom domain later: add `public/CNAME`, set `base: '/'`.

## 4. Maintenance

**Dependabot** (zero-install, grouped updates). `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
    open-pull-requests-limit: 5

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
```

Also enable Settings → Security → Dependabot security alerts + security updates.

**npm audit:** do NOT make it a blocking CI step (dev-dep advisories don't affect a static bundle). Run `npm audit --omit=dev --audit-level=high` locally before releases; rely on Dependabot security updates; committed lockfile + `npm ci` mitigates install-time supply chain risk.

## 5. Local dev on Windows 11

- Node.js v24 is Active LTS (support to April 2028). Installed via `winget install -e --id OpenJS.NodeJS.LTS` → v24.19.0 present.
- Pin with `"engines": { "node": ">=24" }` in package.json.
- Upgrade later: `winget upgrade -e --id OpenJS.NodeJS.LTS`.
