#!/usr/bin/env bash
# Deploy HiveMind (backend + frontend) to Google Cloud Run.
#
# Prereqs (one-time):
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#   A MongoDB connection string (e.g. MongoDB Atlas).
#
# Usage:
#   PROJECT_ID=my-proj REGION=asia-south1 \
#   MONGO_URL="mongodb+srv://user:pass@cluster/..." \
#   JWT_SECRET="$(openssl rand -hex 32)" \
#   ./deploy-gcp.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
REPO="${REPO:-hivemind}"
DB_NAME="${DB_NAME:-hivemind}"
MONGO_URL="${MONGO_URL:?set MONGO_URL (e.g. MongoDB Atlas connection string)}"
JWT_SECRET="${JWT_SECRET:?set JWT_SECRET}"
EMERGENT_LLM_KEY="${EMERGENT_LLM_KEY:-}"

# Custom-domain mode (optional). Set APEX to serve behind the load balancer:
#   APEX=jamoora.co  ->  frontend at https://jamoora.co (+ www), API at https://api.<APEX>
# When unset, the raw *.run.app URLs are used (frontend & backend are then
# cross-site on the run.app public suffix, so auth cookies will NOT work).
APEX="${APEX:-}"
WWW_HOST="${WWW_HOST:-${APEX:+www.${APEX}}}"
API_HOST="${API_HOST:-${APEX:+api.${APEX}}}"

REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
BACKEND_IMAGE="${REGISTRY}/backend:latest"
FRONTEND_IMAGE="${REGISTRY}/frontend:latest"

echo ">> Enabling required APIs..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com --project "${PROJECT_ID}"

echo ">> Ensuring Artifact Registry repo exists..."
gcloud artifacts repositories describe "${REPO}" --location "${REGION}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1 || \
gcloud artifacts repositories create "${REPO}" --repository-format=docker \
  --location "${REGION}" --project "${PROJECT_ID}"

# ---- Backend: build, push, deploy ----
echo ">> Building & pushing backend image..."
gcloud builds submit ./backend --tag "${BACKEND_IMAGE}" --project "${PROJECT_ID}"

echo ">> Deploying backend to Cloud Run..."
gcloud run deploy hivemind-backend \
  --image "${BACKEND_IMAGE}" \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --platform managed --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "DB_NAME=${DB_NAME},MONGO_URL=${MONGO_URL},JWT_SECRET=${JWT_SECRET},EMERGENT_LLM_KEY=${EMERGENT_LLM_KEY}"

BACKEND_URL="$(gcloud run services describe hivemind-backend \
  --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')"
echo ">> Backend URL: ${BACKEND_URL}"

# ---- Frontend: build with backend URL baked in, push, deploy ----
# In custom-domain mode the browser must call the API on the SAME registrable
# domain (https://api.<APEX>) so SameSite=Lax auth cookies are sent. Calling the
# raw *.run.app backend would be cross-site and silently drop the auth cookies.
if [[ -n "${APEX}" ]]; then
  FRONTEND_BACKEND_URL="https://${API_HOST}"
else
  FRONTEND_BACKEND_URL="${BACKEND_URL}"
fi

echo ">> Building & pushing frontend image (REACT_APP_BACKEND_URL=${FRONTEND_BACKEND_URL})..."
gcloud builds submit ./frontend \
  --config ./frontend/cloudbuild.yaml \
  --substitutions "_BACKEND_URL=${FRONTEND_BACKEND_URL},_IMAGE=${FRONTEND_IMAGE}" \
  --project "${PROJECT_ID}"

echo ">> Deploying frontend to Cloud Run..."
gcloud run deploy hivemind-frontend \
  --image "${FRONTEND_IMAGE}" \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --platform managed --allow-unauthenticated \
  --port 8080

FRONTEND_URL="$(gcloud run services describe hivemind-frontend \
  --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')"

# ---- Lock CORS to the public frontend origin(s) ----
# Browser Origin is the public domain (or the run.app frontend when no APEX),
# never the backend URL — so CORS must allow those origins.
if [[ -n "${APEX}" ]]; then
  CORS_ORIGINS="https://${APEX},https://${WWW_HOST}"
else
  CORS_ORIGINS="${FRONTEND_URL}"
fi
echo ">> Restricting backend CORS to ${CORS_ORIGINS}..."
# Values may contain commas — use ^:^ as the pair separator (see gcloud topic escaping).
gcloud run services update hivemind-backend \
  --region "${REGION}" --project "${PROJECT_ID}" \
  --update-env-vars=^:^CORS_ORIGINS="${CORS_ORIGINS}"

echo ""
echo "Done."
if [[ -n "${APEX}" ]]; then
  echo "  Frontend: https://${APEX} (also https://${WWW_HOST})"
  echo "  Backend:  https://${API_HOST}"
  echo "  (Cloud Run URLs — frontend: ${FRONTEND_URL}, backend: ${BACKEND_URL})"
else
  echo "  Frontend: ${FRONTEND_URL}"
  echo "  Backend:  ${BACKEND_URL}"
fi
