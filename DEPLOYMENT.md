# Deploying PipelinePulse to Google Cloud (manual walkthrough)

Everything runs in GCP: **Cloud SQL** (Postgres) + **Cloud Run** (backend & frontend) + **Cloud Scheduler** (pipeline ticks). Budget: covered by free tier + your credits; the only always-billing piece is Cloud SQL (~$10/mo after credits).

Run these from **PowerShell in a fresh terminal** (so `gcloud` is on PATH). Commands assume region `us-central1`.

---

## 0. One-time setup

```powershell
gcloud auth login                        # opens browser
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com cloudscheduler.googleapis.com artifactregistry.googleapis.com
```

`YOUR_PROJECT_ID` is on the console dashboard (e.g. `pipelinepulse-431922`). Enabling APIs takes ~2 min.

## 1. Generate your production secrets

```powershell
cd "c:\Users\USER\OneDrive\Documents\NEW Project\PipelinePulse\backend"
.\.venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print('FERNET_KEY=' + Fernet.generate_key().decode())"
.\.venv\Scripts\python.exe -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48)); print('SCHEDULER_SECRET=' + secrets.token_urlsafe(32)); print('DB_PASSWORD=' + secrets.token_urlsafe(24))"
```

Copy the four values somewhere safe (a local note, NOT into git). You'll paste them below.

## 2. Create the database (Cloud SQL Postgres)

```powershell
gcloud sql instances create pipelinepulse-db `
  --database-version=POSTGRES_16 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --storage-size=10 `
  --storage-type=HDD
```

⏳ This takes ~10 minutes. Then:

```powershell
gcloud sql users set-password postgres --instance=pipelinepulse-db --password="YOUR_DB_PASSWORD"
gcloud sql databases create pipelinepulse --instance=pipelinepulse-db
```

Note your **instance connection name** (`PROJECT_ID:us-central1:pipelinepulse-db`):

```powershell
gcloud sql instances describe pipelinepulse-db --format="value(connectionName)"
```

## 3. Deploy the backend to Cloud Run

Create `backend/env.yaml` (it's gitignored — never commit it), replacing the placeholders:

```yaml
DATABASE_URL: "postgresql+asyncpg://postgres:YOUR_DB_PASSWORD@/pipelinepulse?host=/cloudsql/PROJECT_ID:us-central1:pipelinepulse-db"
JWT_SECRET: "YOUR_JWT_SECRET"
FERNET_KEY: "YOUR_FERNET_KEY"
SCHEDULER_SECRET: "YOUR_SCHEDULER_SECRET"
COOKIE_SECURE: "true"
```

> The odd-looking `@/pipelinepulse?host=/cloudsql/...` means "connect over the Cloud SQL unix socket", which Cloud Run mounts when you pass `--add-cloudsql-instances`. No IP allowlisting needed.

Then deploy **from the backend folder** (Cloud Build builds the Dockerfile in the cloud — no local Docker needed):

```powershell
cd backend
gcloud run deploy pipelinepulse-api `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --add-cloudsql-instances PROJECT_ID:us-central1:pipelinepulse-db `
  --env-vars-file env.yaml `
  --memory 512Mi `
  --min-instances 0
```

First build takes ~5 min. It prints a **Service URL** like `https://pipelinepulse-api-xxxxx-uc.a.run.app` — copy it, then verify:

```powershell
curl https://pipelinepulse-api-xxxxx-uc.a.run.app/health
# → {"status":"ok"}
```

## 4. Schedule pipeline runs (Cloud Scheduler)

```powershell
gcloud scheduler jobs create http pipelinepulse-tick `
  --location us-central1 `
  --schedule "*/5 * * * *" `
  --uri "https://pipelinepulse-api-xxxxx-uc.a.run.app/internal/scheduler/tick" `
  --http-method POST `
  --headers "X-Scheduler-Secret=YOUR_SCHEDULER_SECRET"
```

Test it immediately instead of waiting 5 minutes:

```powershell
gcloud scheduler jobs run pipelinepulse-tick --location us-central1
```

## 5. Deploy the frontend to Cloud Run

```powershell
cd ..\frontend
gcloud run deploy pipelinepulse-web `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars "BACKEND_URL=https://pipelinepulse-api-xxxxx-uc.a.run.app" `
  --memory 512Mi `
  --min-instances 0
```

The printed URL (e.g. `https://pipelinepulse-web-xxxxx-uc.a.run.app`) **is your live site**. 🎉

## 6. Smoke test the live site

1. Open the frontend URL → landing page with the 3D control room.
2. Get started → sign up with a real-looking email + password.
3. Pipelines → **Load sample** → **Run now** → should finish with ~30 rows.
4. Dashboard → KPI cards fill in, Daily Volume chart draws, quality = 100%.
5. Close the browser entirely. Wait ~10 minutes. Reopen → Run History should show a `scheduled` run — that's Cloud Scheduler doing its job with your laptop off. That's the moment it's truly "hosted."

## 7. Guard your credits

```powershell
gcloud billing budgets create --billing-account=$(gcloud billing projects describe YOUR_PROJECT_ID --format="value(billingAccountName)" | Split-Path -Leaf) --display-name="pipelinepulse-budget" --budget-amount=15USD --threshold-rule=percent=0.5 --threshold-rule=percent=0.9
```

(Or in the console: Billing → Budgets & alerts → Create budget → $15/month.) You'll get an email at $7.50 and $13.50. Expected steady-state: **~$9–11/mo, all from Cloud SQL** — everything else stays in free tier at your traffic. When credits run out, either keep paying or migrate the DB to Neon's free tier (change `DATABASE_URL`, redeploy — 5 minutes).

---

## Useful commands once it's live

```powershell
# Stream backend logs
gcloud run services logs read pipelinepulse-api --region us-central1 --limit 50

# Check scheduler run history
gcloud scheduler jobs describe pipelinepulse-tick --location us-central1

# Redeploy after code changes (same command as the original deploy)
cd backend;  gcloud run deploy pipelinepulse-api --source . --region us-central1
cd frontend; gcloud run deploy pipelinepulse-web --source . --region us-central1

# Tear everything down (stops all billing)
gcloud run services delete pipelinepulse-api --region us-central1
gcloud run services delete pipelinepulse-web --region us-central1
gcloud scheduler jobs delete pipelinepulse-tick --location us-central1
gcloud sql instances delete pipelinepulse-db
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Backend deploy succeeds but `/health` 503s | DB connection failing — check `gcloud run services logs read pipelinepulse-api`; usually a typo in `DATABASE_URL` or missing `--add-cloudsql-instances` |
| Login works but you're logged out immediately | `COOKIE_SECURE` not `"true"`, or you're opening the backend URL directly instead of the frontend |
| First request after idle takes ~5s | Cold start (scale-to-zero). Normal on free tier; `--min-instances 1` fixes it but bills ~$8/mo |
| Scheduler job returns 403 | `X-Scheduler-Secret` header doesn't match the backend's `SCHEDULER_SECRET` env var |
| `gcloud` not recognized | Open a new terminal (PATH updates only apply to new shells) |
