# github-actions-ec2-pipeline

> GitHub Actions pipeline that builds, tests, versions, and deploys a Node.js app
> to AWS EC2 with PM2 reload, rollback support, and scheduled health checks.

[![CI Pipeline](https://github.com/darestack/github-actions-ec2-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/darestack/github-actions-ec2-pipeline/actions/workflows/ci.yml)

---

## Pipeline Overview

```
Push to main / feature branch
  │
  └── ci.yml
        ├── build-and-test: Node 22/24 matrix → npm ci → Jest tests → ESLint gate
        └── bump-version (main only): patch version bump → git tag v1.x.x
                │
                └── release.yml (triggered by tag v*)
                      ├── deploy: tar.gz → SCP to EC2 → deploy.sh (PM2 reload, atomic symlink swap)
                      └── create-release: GitHub Release with changelog
```

### Key Design Decisions

| Decision | Implementation | Why |
|---|---|---|
| **Low-interruption deploy** | `pm2 reload` + atomic symlink swap (`current -> release-timestamp`) | Keeps deploy behavior predictable and rollback-friendly |
| **Auto-rollback** | `deploy.sh` keeps the previous `current` target until the new release passes health checks | Restores the last known-good symlink if deploy breaks the app |
| **Automatic versioning** | `bump-version` job creates `v1.x.x` tags on every merge to main | Release history is automatic; no manual tagging |
| **Health check monitoring** | Scheduled workflow runs hourly and reuses one open health-check issue while an outage is active | Avoids duplicate alert noise and keeps incident state readable |
| **Separate CI / CD workflows** | `ci.yml` + `release.yml` split by tag trigger | CD only runs on verified, tagged builds — not every push |

---

## Workflows

### `ci.yml` — Continuous Integration
Triggers: push to `main`, `development`, `feature/*` branches + all PRs

1. **`build-and-test`**: Node 22/24 matrix → `npm ci` → Jest test suite → ESLint gate
2. **`bump-version`** (main only): increments patch version, pushes `v1.x.x` tag — triggers `release.yml`

### `release.yml` — Continuous Deployment  
Triggers: new tag matching `v*`

1. **`deploy`**: packages build → SCP to EC2 → runs `/var/www/app/scripts/deploy.sh`
   - Installs dependencies in release dir → atomic symlink `current` → `pm2 reload`
   - On failure: restores previous symlink → `pm2 reload` (auto-rollback)
2. **`create-release`**: publishes GitHub Release with tag name

### `health-check.yml` — Uptime Monitoring
Runs hourly. Hits `/api/health` for configured environments. If a check fails, the workflow creates one health-check issue or comments on the existing open issue instead of creating duplicates.

---

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `PROD_EC2_HOST` | Production EC2 hostname or IP |
| `PROD_EC2_USER` | SSH username |
| `PROD_EC2_KEY` | Private SSH key (PEM format) |
| `REPO_ACCESS_TOKEN` | PAT with `repo` scope — needed for `bump-version` to push tags |

Also set: **Actions → General → Workflow permissions → Read and write** (allows built-in token to create releases and issues).

---

## Application Stack

`Node.js 22/24` · `Express` · `Jest` · `PM2` · `GitHub Actions` · `AWS EC2`

The EC2 host should run Node.js 22 or 24 so the deployed runtime matches CI.

---

## Local Setup

```bash
git clone https://github.com/darestack/github-actions-ec2-pipeline.git
cd github-actions-ec2-pipeline
npm install
npm test
npm start
# → http://localhost:3000
# → http://localhost:3000/api/health
```

To add Nginx as a reverse proxy on the EC2 instance (port 80 → 3000):
```nginx
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
