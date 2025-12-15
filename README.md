# Auralis HRMS & ATS System

**Auralis** — From "aura" + "analysis" — symbolizes an intelligent aura guiding HR.

A comprehensive Human Resource Management System (HRMS) with Applicant Tracking System (ATS) powered by AI, featuring real-time processing and intelligent candidate matching. NOTE: this repository is currently scoped to a text-first ATS workflow — voice/video interview analysis and audio STT flows have been removed from the mainline to simplify the stack and dependencies. Text-based interview generation and LLM scoring remain fully supported.

## 🎯 Implementation Status (October 2025)
DEMO VIDEO: https://drive.google.com/file/d/1YjKf8x-dTNZHciMD9hoEv8ABSex8-yfx/view?usp=sharing
### ✅ Core Components (Fully Implemented)
- **FastAPI Backend**: Enhanced API gateway with comprehensive monitoring
- **MongoDB Integration**: Optimized data models with full indexing
- **Redis + Celery**: Robust background processing with retry logic
- **Pinecone Vector DB**: Advanced vector search with metadata filtering
- **Gemini AI**: Advanced interview system with timing and scoring
- **WebSocket Updates**: Real-time updates with fallback polling
- **Monitoring**: Complete metrics and audit system

### 🚧 Completed Features (95%)
1. **Authentication & Security**
   - ✅ Firebase JWT verification
   - ✅ Role-based access control
   - ✅ CORS and trusted host middleware
   - 🔄 Advanced rate limiting (in progress)

2. **AI Processing Pipeline**
  - ✅ Resume processing
  - ✅ Job matching
  - ✅ Text-based interview generation & scoring
  - 🔄 Advanced bias detection (needs enhancement)

3. **Monitoring & Analytics**
   - ✅ Basic health checks
   - ✅ Prometheus metrics
   - 🔄 Comprehensive Grafana dashboards (pending)
   - 🔄 Advanced cost tracking (in development)

### ❌ Pending Implementation
1. **Advanced Features**
   - Complete fairness monitoring system
   - Advanced analytics dashboards
   - Cost optimization rules

2. **Production Infrastructure**
   - GCP deployment configurations
  # Auralis — AI-powered HRMS & ATS

  This repository contains the Auralis HRMS & ATS interface: a monorepo with a FastAPI backend and a React + TypeScript frontend. The system includes an AI-driven interview generation and scoring pipeline (Gemini-based), background workers (Celery + Redis), and vector search (Pinecone).

  This README documents how the project is organized, how to run it locally (including Windows-specific Celery guidance), important files, and recent fixes made to improve interview persistence and frontend display.

  **High-level overview**
  - Backend: `backend/` — FastAPI, Celery workers, async MongoDB access (Motor), services for scoring, embedding, and notifications.
  - Frontend: `frontend/` — React + TypeScript (Vite), Tailwind, Firebase auth, role-based UI.
  - Docs: `docs/` — deployment and frontend notes.

  **Important note:** Recent changes were made to improve persistence of interview answers and to surface LLM feedback in the UI. See "Notable modified files" below.

  **Table of Contents**
  - Quick start (local)
  - Environment & config
  - Backend: run & workers
  - Frontend: run
  - Key endpoints and DB collections
  - Notable files and recent changes
  - Troubleshooting & tips
  - Developer notes

  ## Quick start (local)

  Prerequisites
  - Python 3.11+ (3.13 tested in this repo)
  - Node.js (or Bun) and package manager
  - Docker (optional) for local Redis & MongoDB

  Recommended local steps (PowerShell on Windows):

  1) Start Redis and Mongo (Docker Compose)
  ```powershell
  cd backend
  docker-compose -f docker/docker-compose.yaml up -d redis mongodb
  ```

  2) Prepare Python environment and install dependencies
  ```powershell
  cd backend
  python -m venv .venv
  .\.venv\Scripts\Activate
  pip install -r requirements.txt
  ```

  3) Set environment variables (example)
  ```powershell
  copy env.example .env
  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\backend\gcp-sa-key.json"
  ```

  4) Start the FastAPI server
  ```powershell
  cd backend
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```

  5) Start Celery worker (Windows users):
  Celery pool implementations like `prefork` don't work on Windows reliably. Use the `solo` pool.
  ```powershell
  cd backend
  .\.venv\Scripts\Activate
  celery -A app.workers.celery_app worker --loglevel=info --pool=solo
  ```

  6) Start frontend dev server (from repo root)
  ```powershell
  cd frontend
  npm install
  npm run dev   # or `bun dev` if you prefer Bun
  ```

  ## Environment & configuration
  - Backend: `backend/env.example` contains the environment variable template (Mongo URI, Redis URL, Gemini API key, Firebase, GCS keys).
  - Frontend: `frontend/env.example` contains Firebase and API base URL configuration.

  ## Backend: key endpoints & DB collections
  - `GET /job/jobs/{job_id}/final-results` — returns full application documents (now normalized for JSON-safe types).
  - Applications collection: `applications` — stores `gemini_questions`, `gemini_answers`, `interview_statistics`, `interview_score`, etc.
  - Interview sessions: `interview_sessions` — transient session state, `responses` and `scores` per session.

  Other relevant collections: `jobs`, `job_matches`, `candidates`.

  ## Notable files and recent changes
  - `backend/app/workers/interview_worker.py` — improved evaluation path, ensured `check_time_remaining()` returns `elapsed`, uses `scorer_service.score_response`, persists session responses, and now attempts an `array_filters` update into `applications.gemini_answers` and falls back to pushing a new element. Added diagnostic logging for update results.
  - `backend/app/routes/interview.py` — submit handler now persists candidate answers into `applications.gemini_answers` at submit time (so UI sees answers immediately); authorization checks adjusted to avoid turning 4xx into 500; re-raises HTTPExceptions.
  - `backend/app/routes/job.py` — `GET /job/jobs/{job_id}/final-results` now normalizes nested Mongo extended JSON wrappers (e.g., `{$date: {$numberLong: '...'}}`) and datetimes into JSON-friendly values so the frontend can display `gemini_answers.feedback` and timestamps reliably.
  - `frontend/src/pages/recruiter/FinalAIResults.tsx` — improved UI: displays full `gemini_answers` (answer text, submitted/evaluated timestamps, score, and pretty-printed feedback JSON) and includes a raw application JSON pane for debugging.

  If you are inspecting persisted documents directly, you'll see `gemini_answers` array items like:
  ```json
  {
    "qid": "Q1",
    "question": "...",
    "answer": "candidate answer",
    "session_id": "interview_APL-...",
    "submitted_at": "2025-11-...",
    "evaluated_at": "2025-11-...",
    "feedback": { /* structured feedback */ },
    "score": 72.5
  }
  ```

  ## Troubleshooting & common issues
  - If Celery worker fails to start on Windows, run with `--pool=solo`.
  - Gemini/LLM errors: you may see `429` quota errors when many tasks run in parallel — implement retries/backoff or limit concurrency.
  - If `feedback` is not visible in the UI: ensure backend `GET /job/jobs/{job_id}/final-results` is returning the `gemini_answers` array (the backend normalizer will convert dates and numeric wrappers). Use the raw JSON view in the UI to inspect the returned document.
  - Missing notifier methods: some builds may show `NotificationService` missing `notify_interview_completed` — either implement the notifier method or remove the call in `interview_worker.finalize_interview`.

  ## Developer notes & flow
  1. Candidate flow
    - Frontend requests interview questions (`generate_interview_questions` task) → `interview_sessions` created and `gemini_questions` persisted to `applications`.
    - Candidate submits answers via the API; answers are persisted into `interview_sessions.responses` and pushed to `applications.gemini_answers` immediately.
    - Celery `evaluate_interview_response` tasks score responses asynchronously and write feedback back to both `interview_sessions.scores` and `applications.gemini_answers` (attempts in-place array update, falls back to push).
    - When session completes, `finalize_interview` aggregates scores and writes `interview_score` and `interview_statistics` to the application doc.

  2. Scoring service
    - `backend/app/services/scorer.py` exposes `score_response(question, response, job_description, transcript)` and `score_interview_answers(...)`.
    - Worker uses `score_response` (wrapped via `asyncio.to_thread`) to avoid blocking the event loop.

  ## Tests & verification
  - Backend tests are in `backend/` (e.g., `test_system.py`, `test_gcp.py`, `test_redis.py`). Run them from `backend` with your preferred test runner.

  ## Next steps & recommendations
  - Add more diagnostic logging (optionally gated by env var) to log `update_result.matched_count` and the pre-update `gemini_answers` array when matched==0 — this helps diagnose field-name mismatches.
  - Improve retry/backoff for Gemini calls and implement a rate limiter to avoid 429 quota errors.
  - Implement `NotificationService.notify_interview_completed` or handle missing notifier gracefully.
  - Add a small admin UI to re-run scoring for a specific application or re-sync `gemini_answers` values.

  ---

  If you want, I can now:
  - Run `uvicorn` and call `/job/jobs/<job_id>/final-results` to paste back a sample JSON response, or
  - Add an endpoint that returns a single application by `application_id` (normalized), or
  - Add richer debug logs that dump `gemini_answers` before update when matched_count is 0.

  Pick one and I'll proceed.

  ## **Backend Deployment & Production Flow (GCP + Vercel)**

  This project showcases backend engineering and deployment practices: a FastAPI backend + Celery workers deployed on GKE, files stored in Google Cloud Storage (GCS), and a frontend hosted on Vercel which proxies API calls to the backend.

  ### **Concise Architecture**
  ```
  [Developer/CI] -> Build & Push Images -> Artifact Registry
                       |
                       v
                    GKE Cluster
  GKE: auralis-api (FastAPI)
    - Auth (Firebase)
    - Resume upload -> GCS
    - Enqueue -> Redis (Celery)
    - Job endpoints -> MongoDB
    - WebSocket manager

  GKE: auralis-worker (Celery)
    - Listens to Redis queues
    - Processes resumes (GCS -> parse -> embed -> Pinecone)
    - Persists results -> MongoDB

  Shared infra: Redis, MongoDB, GCS
  Frontend (Vercel) -> rewrites /api -> auralis-api
  Observability: Prometheus/Grafana and Cloud Logging
  ```

  ### **GCP deployment details**
  - **Service Account**: Create a service account with `roles/storage.objectAdmin` (or narrower scoped roles if desired). Create a JSON key and store it as `auralis-gcp-key` in Kubernetes (or use Secret Manager).
  - **GCS Bucket**: Create `hrms-resumes-bucket` (or your own). The bucket name is stored in `auralis-secrets` as `GCS_BUCKET_NAME` and read via app settings.
  - **Artifact Registry**: CI builds backend images and pushes them to Artifact Registry or GCR. Use immutable tags for production releases.
  - **Kubernetes Manifests**: `k8s/api-deployment.yaml` and `k8s/worker-deployment.yaml` expect:
    - `auralis-gcp-key` secret mounted at `/var/secrets/gcp` and `GOOGLE_APPLICATION_CREDENTIALS=/var/secrets/gcp/key.json`
    - `auralis-secrets` containing Redis/Mongo/API keys and `GCS_BUCKET_NAME`
    - Readiness/liveness probes on port 8000
  - **Ingress & NEG**: Use GKE Ingress with NEG for LB-backed L7 routing and health checks.

  ## **Docker: Local dev and CI usage**

  Docker is used in two places: local development (via `docker-compose`) and CI/build pipelines (image build & push).

  - **Local development**: `docker/docker-compose.yaml` spins up the minimal infra (Redis, MongoDB) for developers to run the API and workers locally. This removes the need for external services and mirrors production dependencies.
    - Start local infra: `docker-compose -f docker/docker-compose.yaml up -d redis mongodb`
    - Useful for running `backend` tests and local worker processing.

  - **Image builds & CI**: The `backend/docker/Dockerfile.api` and `backend/docker/Dockerfile.worker` build the production images for the API and worker respectively. CI (Cloud Build or GitHub Actions) builds these images and pushes them to Artifact Registry/GCR, which are then deployed to GKE.
    - Build locally: `docker build -f backend/docker/Dockerfile.api -t us-central1-docker.pkg.dev/$PROJECT/auralis-repo/auralis-api:latest backend`
    - Push: `docker push us-central1-docker.pkg.dev/$PROJECT/auralis-repo/auralis-api:latest`

  ### Docker flowchart
  ```
  Developer Laptop --docker-compose--> Local Redis & Mongo
  Developer Laptop --docker build--> API & Worker Images
  CI (GitHub Actions / Cloud Build) --build/push--> Artifact Registry
  Artifact Registry --deploy--> GKE Cluster
  Local Redis & Mongo --used by--> Local API & Worker (dev)
  ```

  ### **Vercel frontend notes**
  - **Rewrite /api**: In `vercel.json` rewrite `/api/:path*` to your backend domain to avoid mixed-content errors when frontend is served over HTTPS.
  - **Environment variables**: Set `VITE_API_URL` and `VITE_WS_URL` in Vercel dashboard; the frontend falls back to `/api` at runtime in case of mixed-content.
  - **Websockets**: Ensure Vercel or your proxy supports WebSocket upgrades (used for job status updates).

  ### **Deployment checklist (operator)**
  1. Build & push images (CI): tag with `vX.Y.Z` and push to Artifact Registry.  
  2. Create/patch `auralis-gcp-key` and `auralis-secrets` (in `auralis` namespace).  
  3. kubectl apply -f k8s/api-deployment.yaml && kubectl apply -f k8s/worker-deployment.yaml  
  4. kubectl rollout restart deployment/auralis-api -n auralis  
  5. Confirm pods ready and check logs (`kubectl get pods -n auralis`, `kubectl logs -l app=auralis-api -n auralis`)  
  6. On Vercel, verify rewrite is active and `VITE_API_URL` points to `https://<your-backend>` or rely on the `/api` fallback.

  ### **Common issues & fixes**
  - CreateContainerConfigError: missing secret key referenced in deployment (check `auralis-secrets` in `auralis`).  
  - GCS upload: ensure `GCS_BUCKET_NAME` exists and `auralis-gcp-key` is mounted; run `backend/test_gcp.py` locally to verify.  
  - Mixed-content: ensure `/api` is proxied via Vercel or `/api` fallback is used by frontend.

