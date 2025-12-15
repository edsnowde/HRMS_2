# Auralis — Full Project Workflow

This document presents a single, comprehensive workflow that covers the frontend, backend, worker processing, storage, CI/CD, deployment (GKE), Docker usage, secrets, observability, and testing. The diagram below is intentionally detailed — each numbered step in the diagram is explained below so operators and developers can reason about, reproduce, and debug the full system.

## Full Workflow Diagram

```
Browser (Candidate / Recruiter / User)
  |
  v
Vercel (Frontend)
  |
  v
React Client
  |
  v
auralis-api (FastAPI) [GKE]
  - Auth (Firebase JWT verify)
  - POST resume upload -> GCS (uses GCS_BUCKET_NAME)
  - Enqueue tasks -> Redis (Celery broker)
  - Job endpoints -> MongoDB
  - WebSocket manager -> clients

auralis-worker (Celery) [GKE]
  - Listens to Redis queue
  - Downloads from GCS, parses, creates embeddings
  - Upserts embedding -> Pinecone
  - Persists results -> MongoDB

Shared Infra:
  - Redis (Cloud Memorystore)
  - MongoDB Atlas
  - GCS bucket (resumes)

Observability & Secrets:
  - Metrics -> Prometheus / Grafana
  - Logs -> Cloud Logging
  - Secrets -> auralis-secrets, auralis-gcp-key (mounted)

Local dev:
  - Developer Laptop -> docker-compose (Redis + Mongo)
  - Frontend dev server -> React Client

Error cases:
  - Pod startup: missing secret -> CreateContainerConfigError
  - Resume upload: missing GCS -> 500 ('Google Cloud Storage client not configured')
```

## Step-by-step Workflow Explanations

1) Frontend (Vercel + Client)
- The frontend is hosted on Vercel (HTTPS). To avoid mixed-content issues, `/api/:path*` is rewritten to the backend URL, and `VITE_API_URL` falls back to `/api` at runtime.
- The client opens WebSocket connections to `/api/jobs/ws` (proxied) for real-time job updates.

2) API (FastAPI on GKE)
- Authentication: Every request is validated (Firebase JWT + role mapping).
- Resume upload route: Accepts multipart file uploads, stores files in GCS, creates a JobStatus document in Mongo, and enqueues a background task to Redis (Celery).
- Job endpoints: `GET /job/list`, `GET /job/jobs/{job_id}/final-results`, job matching, and scoring APIs.
- WebSocket manager: publishes job and worker progress to connected clients.

3) Workers (Celery)
- Workers subscribe to Redis queues by name (`resume`, `scoring`, `cleanup`).
- Resume parsing: download file from GCS, text extraction, parsing, NER, produce candidate document.
- Embedding: create embedding via Gemini or a fallback, upsert to Pinecone, cache embeddings in Redis.
- Scoring: call Gemini for structured scoring/explanations, persist feedback to `applications.gemini_answers` and `interview_sessions`.

4) Storage & Databases
- GCS stores raw resumes and other large files. The `GCS_BUCKET_NAME` env must be set and credentials made available via `auralis-gcp-key`.
- Mongo stores application, job, session, and audit documents.
- Pinecone stores embeddings and metadata for similarity queries.

5) Secrets & Config
- `auralis-secrets` stores sensitive values: `REDIS_URL`, `MONGO_URL`, `DATABASE_URL`, `SECRET_KEY`, `GEMINI_API_KEY`, `PINECONE_API_KEY`, `GCS_BUCKET_NAME`.
- `auralis-gcp-key` holds the GCP service account JSON and is mounted at `/var/secrets/gcp/key.json`. `GOOGLE_APPLICATION_CREDENTIALS` points to this file.

6) Deployment & CI
- CI builds images (Cloud Build/Github Actions), pushes to Artifact Registry/GCR, then applies manifests to GKE (or Cloud Run for alternate deployments).
- Kubernetes manifests include `api-deployment.yaml` and `worker-deployment.yaml` with probes, envs, and volume mounts.

7) Docker & Local Development
- `docker/docker-compose.yaml` provides `redis` and `mongodb` for local dev. `backend/docker/Dockerfile.api` and `backend/docker/Dockerfile.worker` are used to build production images.

8) Observability & Ops
- Metrics: Prometheus + Grafana (or Cloud Monitoring) collects API and worker metrics.
- Logs: Cloud Logging or centralized log aggregator for troubleshooting and audit.
- Alerts & SLOs: Queue length, job failure rate, and LLM error rates drive autoscaling and paging rules.

9) Error Cases & Troubleshooting
- CreateContainerConfigError: pod referencing missing secret keys (e.g., missing `GCS_BUCKET_NAME`) will fail to start — inspect `kubectl describe pod` and `kubectl get secret -n auralis`.
- GCS upload 500: backend returns a clear message if GCS credentials or bucket name are missing; run `backend/test_gcp.py` to validate GCS connectivity locally.

The rendered SVG of the diagram will be generated at `docs/WORKFLOW.svg` by the included GitHub Action (or you can run `npm run render:mermaid` locally). If you'd like the SVG committed immediately, run the workflow manually from the Actions tab or push a change to `docs/WORKFLOW.md`.

## Operator Checklists

- **Bootstrap cluster**: create `auralis` namespace; create `auralis-gcp-key`, `auralis-secrets` and apply manifests.
- **Deploy**: `kubectl apply -f k8s/api-deployment.yaml -n auralis && kubectl apply -f k8s/worker-deployment.yaml -n auralis`
- **Verify**: `kubectl get pods -n auralis`, `kubectl logs -l app=auralis-api -n auralis --tail=200`, `kubectl describe pod <failing-pod> -n auralis`
- **GCS test**: locally set `GOOGLE_APPLICATION_CREDENTIALS` and `GCS_BUCKET_NAME` and run `python backend/test_gcp.py`.

