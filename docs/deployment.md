# Deployment to GKE

This document explains steps to deploy the application to GKE and Artifact Registry.

Step 1 — Set variables (replace with your values):
```powershell
$PROJECT="hrms-476316"
$REGION="us-central1"
$ZONE="us-central1-a"
$CLUSTER="auralis-hrms-cluster"
$REPO="auralis-repo"
```

Step 2 — Authenticate gcloud and set project
```powershell
gcloud auth login
gcloud config set project $PROJECT
```

Step 3 — Enable required GCP APIs
```powershell
gcloud services enable container.googleapis.com artifactregistry.googleapis.com iam.googleapis.com cloudbuild.googleapis.com
```

Step 4 — Create the Artifact Registry Docker repo
```powershell
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="Docker repo for auralis"
```

Step 5 — Create a GKE cluster
```powershell
gcloud container clusters create $CLUSTER --zone $ZONE --num-nodes=2 --machine-type=e2-medium --enable-ip-alias
gcloud container clusters get-credentials $CLUSTER --zone $ZONE --project $PROJECT
kubectl get nodes
```

Step 6 — Create service account for GitHub Actions and grant roles
```powershell
gcloud iam service-accounts create github-deploy-sa --display-name="GitHub Actions deploy"
$SA_EMAIL="github-deploy-sa@$PROJECT.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA_EMAIL" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA_EMAIL" --role="roles/container.developer"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA_EMAIL" --role="roles/container.clusterAdmin"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountUser"
```

Step 7 — Create and download service account key
```powershell
gcloud iam service-accounts keys create gcp-sa-key.json --iam-account=$SA_EMAIL
Get-Content -Raw gcp-sa-key.json
```

Step 8 — Add GitHub secrets
- GCP_PROJECT (your project id)
- GKE_CLUSTER
- GKE_ZONE
- GCP_SA_KEY (paste or use gh CLI)

Step 9 — Create Kubernetes runtime secrets (replace placeholders)
```powershell
kubectl create secret generic auralis-secrets `
  --from-literal=REDIS_URL="redis://<redis-host>:6379/0" `
  --from-literal=MONGO_URL="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/ai_ats?authSource=admin" `
  --from-literal=DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/ai_ats?authSource=admin" `
  --from-literal=SECRET_KEY="$(python -c 'import secrets;print(secrets.token_urlsafe(32))')" `
  --from-literal=GEMINI_API_KEY="<your-gemini-key>"
```

Step 10 — Create Docker image pull secret (if not using Workload Identity)
```powershell
kubectl create secret docker-registry regcred `
  --docker-server=us-central1-docker.pkg.dev `
  --docker-username=_json_key `
  --docker-password="$(Get-Content -Raw gcp-sa-key.json)" `
  --docker-email=you@example.com
```

Step 11 — Build & push images (recommended to use Cloud Build if your local Docker times out):
```powershell
# Build
docker build --no-cache -f backend/docker/Dockerfile.api -t us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-api:latest backend
docker build --no-cache -f backend/docker/Dockerfile.worker -t us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-worker:latest backend

# Push (ensure you ran: gcloud auth configure-docker us-central1-docker.pkg.dev)
docker push us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-api:latest
docker push us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-worker:latest

# Or use Cloud Build (recommended):
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-api:latest backend
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-worker:latest backend
```

Step 12 — Deploy to GKE manually (or via our GitHub Actions workflow)
```powershell
kubectl apply -f k8s/secret-template.yaml || true
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl apply -f k8s/service-api.yaml || true

kubectl set image deployment/auralis-api auralis-api=us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-api:latest --record
kubectl set image deployment/auralis-worker auralis-worker=us-central1-docker.pkg.dev/$PROJECT/$REPO/auralis-worker:latest --record

kubectl rollout status deployment/auralis-api --timeout=120s
kubectl rollout status deployment/auralis-worker --timeout=120s
```

Security & Notes
- If using Workload Identity prefer that over regcred.
- Ensure `auralis-secrets` exists with runtime keys.
- For Ingress: `auralis-cert` referenced in the Ingress must be provisioned with Google managed certificates.
- If image pulls fail, verify `regcred` or Workload Identity.

Troubleshooting build-timeouts
- Artifactory/Cloud Build has better network reliability than local Docker.
- Pin CPU torch wheel as recommended in `backend/requirements.txt` to reduce image size.

*** End of Deployment Guide ***
