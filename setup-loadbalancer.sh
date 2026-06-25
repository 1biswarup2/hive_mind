#!/usr/bin/env bash
# Put a Global External Application Load Balancer with a reserved STATIC IP in
# front of the HiveMind Cloud Run services, so you can map them to DNS.
#
#   jamoora.co / www.jamoora.co  -> frontend
#   api.jamoora.co               -> backend
#
# One static IPv4 + one Google-managed TLS cert (auto-renewed) for all three.
#
# Usage:
#   PROJECT_ID=yal-discovery-scaling REGION=asia-south1 \
#   APEX=jamoora.co API_HOST=api.jamoora.co \
#   ./setup-loadbalancer.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
APEX="${APEX:-jamoora.co}"
WWW_HOST="${WWW_HOST:-www.${APEX}}"
API_HOST="${API_HOST:-api.${APEX}}"

FRONTEND_SVC="${FRONTEND_SVC:-hivemind-frontend}"
BACKEND_SVC="${BACKEND_SVC:-hivemind-backend}"

# Resource names
IP_NAME="hivemind-ip"
FE_NEG="hivemind-frontend-neg"
BE_NEG="hivemind-backend-neg"
FE_BES="hivemind-frontend-bes"
BE_BES="hivemind-backend-bes"
URLMAP="hivemind-urlmap"
REDIRECT_URLMAP="hivemind-http-redirect"
CERT="hivemind-cert2"
HTTPS_PROXY="hivemind-https-proxy"
HTTP_PROXY="hivemind-http-proxy"
HTTPS_FR="hivemind-https-fr"
HTTP_FR="hivemind-http-fr"

gc() { gcloud "$@" --project "${PROJECT_ID}"; }
exists() { "$@" >/dev/null 2>&1; }

echo ">> Enabling compute API..."
gc services enable compute.googleapis.com

echo ">> Reserving global static IP..."
exists gc compute addresses describe "${IP_NAME}" --global || \
  gc compute addresses create "${IP_NAME}" --global --ip-version=IPV4
STATIC_IP="$(gc compute addresses describe "${IP_NAME}" --global --format='value(address)')"

echo ">> Creating serverless NEGs (point at Cloud Run services)..."
exists gc compute network-endpoint-groups describe "${FE_NEG}" --region "${REGION}" || \
  gc compute network-endpoint-groups create "${FE_NEG}" --region "${REGION}" \
    --network-endpoint-type=serverless --cloud-run-service="${FRONTEND_SVC}"
exists gc compute network-endpoint-groups describe "${BE_NEG}" --region "${REGION}" || \
  gc compute network-endpoint-groups create "${BE_NEG}" --region "${REGION}" \
    --network-endpoint-type=serverless --cloud-run-service="${BACKEND_SVC}"

echo ">> Creating backend services..."
exists gc compute backend-services describe "${FE_BES}" --global || \
  gc compute backend-services create "${FE_BES}" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED
exists gc compute backend-services describe "${BE_BES}" --global || \
  gc compute backend-services create "${BE_BES}" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED

echo ">> Attaching NEGs to backend services..."
gc compute backend-services add-backend "${FE_BES}" --global \
  --network-endpoint-group="${FE_NEG}" --network-endpoint-group-region="${REGION}" 2>/dev/null || true
gc compute backend-services add-backend "${BE_BES}" --global \
  --network-endpoint-group="${BE_NEG}" --network-endpoint-group-region="${REGION}" 2>/dev/null || true

echo ">> Building URL map (host-based routing)..."
exists gc compute url-maps describe "${URLMAP}" || \
  gc compute url-maps create "${URLMAP}" --default-service "${FE_BES}"
# Route the API host to the backend; everything else (apex, www) -> frontend.
exists gc compute url-maps describe "${URLMAP}" --format='value(pathMatchers[].name)' | grep -q api-matcher || \
  gc compute url-maps add-path-matcher "${URLMAP}" \
    --path-matcher-name=api-matcher \
    --default-service="${BE_BES}" \
    --new-hosts="${API_HOST}" 2>/dev/null || true

echo ">> Creating Google-managed SSL certificate for ${APEX}, ${WWW_HOST}, ${API_HOST}..."
exists gc compute ssl-certificates describe "${CERT}" --global || \
  gc compute ssl-certificates create "${CERT}" --global \
    --domains="${APEX},${WWW_HOST},${API_HOST}"

echo ">> Creating HTTPS target proxy + forwarding rule..."
exists gc compute target-https-proxies describe "${HTTPS_PROXY}" --global || \
  gc compute target-https-proxies create "${HTTPS_PROXY}" --global \
    --url-map="${URLMAP}" --ssl-certificates="${CERT}"
exists gc compute forwarding-rules describe "${HTTPS_FR}" --global || \
  gc compute forwarding-rules create "${HTTPS_FR}" --global \
    --target-https-proxy="${HTTPS_PROXY}" --address="${IP_NAME}" --ports=443

echo ">> Creating HTTP->HTTPS redirect..."
if ! exists gc compute url-maps describe "${REDIRECT_URLMAP}"; then
  cat > /tmp/hivemind-redirect.yaml <<EOF
name: ${REDIRECT_URLMAP}
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF
  gc compute url-maps import "${REDIRECT_URLMAP}" --global --source=/tmp/hivemind-redirect.yaml
fi
exists gc compute target-http-proxies describe "${HTTP_PROXY}" --global || \
  gc compute target-http-proxies create "${HTTP_PROXY}" --global --url-map="${REDIRECT_URLMAP}"
exists gc compute forwarding-rules describe "${HTTP_FR}" --global || \
  gc compute forwarding-rules create "${HTTP_FR}" --global \
    --target-http-proxy="${HTTP_PROXY}" --address="${IP_NAME}" --ports=80

echo ""
echo "============================================================"
echo " STATIC IP: ${STATIC_IP}"
echo ""
echo " Add these DNS A records at your domain registrar:"
echo "   ${APEX}.        A   ${STATIC_IP}"
echo "   ${WWW_HOST}.    A   ${STATIC_IP}"
echo "   ${API_HOST}.    A   ${STATIC_IP}"
echo ""
echo " The managed SSL cert stays in PROVISIONING until DNS resolves"
echo " to this IP (typically 15-60 min). Check status with:"
echo "   gcloud compute ssl-certificates describe ${CERT} --global \\"
echo "     --project ${PROJECT_ID} --format='value(managed.status)'"
echo "============================================================"
