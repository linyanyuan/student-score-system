# GitHub Actions + Aliyun ACR Deployment

This repository is configured to build images on GitHub Actions and push them to Aliyun ACR. The server only pulls ready-made images and starts containers. This avoids server-side access to Docker Hub, PyPI, and npm during deployment.

## 1. Prepare Aliyun ACR

Create these resources in Aliyun ACR:

- One ACR instance in the same region as your server
- One namespace, for example `student-score`
- Two repositories:
  - `student-score-backend`
  - `student-score-frontend`

Record these values from the ACR console:

- Registry domain, for example `registry.cn-hangzhou.aliyuncs.com`
- Login username
- Login password
- Namespace name

## 2. Add GitHub Secrets

In GitHub repository settings, create these Actions secrets:

- `ALIYUN_REGISTRY`
  - Example: `registry.cn-hangzhou.aliyuncs.com`
- `ALIYUN_REGISTRY_NAMESPACE`
  - Example: `student-score`
- `ALIYUN_REGISTRY_USERNAME`
  - Use the ACR login username
- `ALIYUN_REGISTRY_PASSWORD`
  - Use the ACR fixed password

## 3. Trigger Image Build

The workflow file is `.github/workflows/build-and-push-acr.yml`.

It runs on:

- Push to `main`
- Push to `dev`
- Manual trigger from GitHub Actions

Each run pushes four tags:

- `student-score-backend:<short-sha>`
- `student-score-backend:latest`
- `student-score-frontend:<short-sha>`
- `student-score-frontend:latest`

Open the workflow run summary after it finishes and copy the published `<short-sha>` tag if you want an immutable deployment tag.

## 4. Prepare the Server

Clone the repository on the server and create a deployment env file:

```bash
cd /opt/student-score-system
cp .env.deploy.example .env.deploy
```

Edit `.env.deploy`:

```dotenv
ACR_REGISTRY=registry.cn-hangzhou.aliyuncs.com
ACR_NAMESPACE=your-namespace
IMAGE_TAG=latest
```

If you want to deploy a specific workflow build, replace `latest` with the workflow summary tag such as `abc1234`.

Ensure the SQLite file exists:

```bash
touch /opt/student-score-system/backend/student_score.db
```

Log in to ACR on the server:

```bash
docker login --username your-acr-username registry.cn-hangzhou.aliyuncs.com
```

## 5. Deploy on the Server

Use the deployment compose file instead of the original build-based compose file:

```bash
cd /opt/student-score-system
docker compose --env-file .env.deploy -f docker-compose.deploy.yml pull
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs --tail=100
```

Do not run:

```bash
docker compose up -d --build
```

That command will try to rebuild on the server and hit the same network problem again.

## 6. Update Flow

When you push new code to `main` or `dev`:

1. GitHub Actions builds and pushes new images to ACR
2. The server pulls the new images
3. Restart with the deploy compose file

Example:

```bash
cd /opt/student-score-system
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=latest/' .env.deploy
docker compose --env-file .env.deploy -f docker-compose.deploy.yml pull
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d
```

If you want reproducible deployments, set `IMAGE_TAG` to the short SHA from the workflow summary instead of `latest`.
