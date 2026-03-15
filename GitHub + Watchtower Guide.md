# **Automated CI/CD Setup: GitHub Actions & Watchtower**

**Goal:** Push code to GitHub → GitHub builds the Docker images → Watchtower on the NUC automatically downloads and restarts the app.

**Architecture:** This monorepo has three apps that each get their own Docker image:

| App | Path | Port | Domain |
|-----|------|------|--------|
| API (Node.js + Express) | `apps/api` | 97 | hoppdrive-api:97 |
| Web (Next.js B2C) | `apps/web` | 99 | hoppdrive:99 |
| Admin CMS (Next.js) | `apps/admin` | 98 | hoppdrive-admin:98 |

## **Step 1: Create a GitHub Personal Access Token (PAT)**

Because your repository and Docker images should be **private** (to protect your client's proprietary code), your NUC needs a password to download the images from GitHub.

1. Go to GitHub.com → Click your profile picture → **Settings**.
2. Scroll to the bottom left → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
3. Click **Generate new token (classic)**.
4. Name it: `NUC_WATCHTOWER_PULL`.
5. Expiration: Set to **No expiration** (or 1 year if you prefer to rotate it).
6. **Scopes:** Check the box that says `read:packages` (this allows it to download Docker images).
7. Generate the token and **copy it somewhere safe**. You will need it on the NUC.

## **Step 2: The GitHub Actions YAML File**

Create this file in your project repository. When you push to the main branch, GitHub's free cloud servers will compile your Next.js and Node.js code and save them as Docker images to the GitHub Container Registry (GHCR).

Create a file at exactly this path: `.github/workflows/deploy.yml`

```yaml
name: Build and Push Docker Images

on:
  push:
    branches:
      - main  # Only run this when pushing to main

jobs:
  build:
    runs-on: ubuntu-latest

    # These permissions allow GitHub Actions to push to your private registry
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}  # Automatically provided by GitHub Actions

      - name: Build & Push API (Node.js Backend)
        uses: docker/build-push-action@v5
        with:
          context: .  # Monorepo root (Dockerfiles use root as build context)
          file: ./apps/api/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/euro-api:latest

      - name: Build & Push Web (Next.js B2C)
        uses: docker/build-push-action@v5
        with:
          context: .  # Monorepo root
          file: ./apps/web/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/euro-web:latest
          build-args: |
            NEXT_PUBLIC_API_URL=https://hoppdrive.ch/api
            NEXT_PUBLIC_ADMIN_URL=https://hoppdrive-admin.ch

      - name: Build & Push Admin CMS (Next.js)
        uses: docker/build-push-action@v5
        with:
          context: .  # Monorepo root
          file: ./apps/admin/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/euro-admin:latest
          build-args: |
            NEXT_PUBLIC_API_URL=https://hoppdrive.ch/api
```

> **Important:** All three Dockerfiles use the monorepo root (`.`) as the build context — not their individual `apps/` subfolder. This is because they need access to `packages/shared` and the root `package.json` workspaces.

## **Step 3: Configure the NUC**

Now, SSH into your Intel NUC. We need to log Docker into GitHub so Watchtower has permission to pull the updates.

**1. Log into GitHub on the NUC:**

Run this command in your NUC's terminal:

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

When it asks for a password, **paste the Personal Access Token (PAT)** you created in Step 1.

**2. Update your docker-compose.yml:**

Open the `docker-compose.yml` file on your NUC. You need to use the `ghcr.io` images, and add the Watchtower service to the bottom.

```yaml
version: '3.8'

services:
  # --- Your App Services ---
  api:
    image: ghcr.io/YOUR_GITHUB_USERNAME/euro-api:latest
    ports:
      - "97:97"
    restart: always
    depends_on:
      - postgres
      - redis

  web:
    image: ghcr.io/YOUR_GITHUB_USERNAME/euro-web:latest
    ports:
      - "99:99"
    restart: always
    depends_on:
      - api

  admin:
    image: ghcr.io/YOUR_GITHUB_USERNAME/euro-admin:latest
    ports:
      - "98:98"
    restart: always
    depends_on:
      - api

  postgres:
    image: postgres:16-alpine
    restart: always
    # ... your db config ...

  redis:
    image: redis:7-alpine
    restart: always

  nginx:
    image: nginx:1.25-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
      - admin
      - api

  # --- The Magic Auto-Updater ---
  watchtower:
    image: containrrr/watchtower
    restart: always
    volumes:
      # Allows Watchtower to control the Docker daemon (restart containers)
      - /var/run/docker.sock:/var/run/docker.sock
      # CRITICAL: Shares the GitHub login credentials so Watchtower can pull private images
      - /root/.docker/config.json:/config.json:ro
    command: --interval 300 --cleanup
```

### **⚠️ CRITICAL FLAGS FOR YOUR NUC:**

Notice the `command: --interval 300 --cleanup` line under Watchtower. This is vital for your specific hardware:

* `--interval 300`: Tells Watchtower to check GitHub for updates every 300 seconds (5 minutes). This prevents Watchtower from spamming GitHub and getting your IP blocked.
* `--cleanup`: **Do not forget this!** Every time you push an update, a new Docker image is downloaded. Since you only have a 256GB drive, old images will fill up your SSD in a matter of weeks. The `--cleanup` flag tells Watchtower to delete the old Docker images immediately after starting the new ones.

### **⚠️ SSL Certificates:**

Your Nginx config serves both `hoppdrive.ch` and `hoppdrive-admin.ch`. Make sure your Certbot command requests a certificate covering both domains:

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d hoppdrive.ch -d www.hoppdrive.ch -d hoppdrive-admin.ch
```

## **Step 4: Let the Magic Happen**

On your NUC, start everything up:

```bash
docker compose up -d
```

**The Workflow is now complete:**

1. You make a change to the code on your laptop.
2. You run `git push origin main`.
3. GitHub Actions spins up a cloud server, compiles all 3 images (API, Web, Admin), and pushes them to GHCR (takes ~3-4 mins).
4. Within 5 minutes, Watchtower on your NUC notices the new images on GitHub.
5. Watchtower quietly downloads them, stops the old containers, starts the new ones, and deletes old image files to save SSD space.

Your NUC CPU stays at 0% during the build, your SSD stays clean, and your Swiss client gets instant updates!