#!/bin/bash
# PetWash Cloud Run Setup Script
# Run this in Google Cloud Shell: https://console.cloud.google.com/cloudshell

set -e

PROJECT_ID="signinpetwash"
REGION="me-west1"
SERVICE_NAME="petwash-api"
REPO_NAME="petwash-api"

echo "🚀 PetWash Cloud Run Setup"
echo "=========================="
echo ""

# Set project
gcloud config set project $PROJECT_ID

echo "1️⃣ Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  --project=$PROJECT_ID

echo "2️⃣ Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID \
  --description="PetWash API Docker images" \
  2>/dev/null || echo "   Repository already exists"

echo "3️⃣ Getting service account for Cloud Run..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "   Service Account: $COMPUTE_SA"

echo "4️⃣ Granting Secret Manager access..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

echo "5️⃣ Creating secrets in Secret Manager..."
echo "   (You'll need to add values manually in the console)"

# Create empty secrets (values added via console)
SECRETS="DATABASE_URL JWT_SECRET COOKIE_SECRET GOOGLE_API_KEY SENDGRID_API_KEY FIREBASE_SERVICE_ACCOUNT_KEY"
for secret in $SECRETS; do
  gcloud secrets create $secret --project=$PROJECT_ID 2>/dev/null || echo "   $secret already exists"
done

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Go to Secret Manager and add values:"
echo "      https://console.cloud.google.com/security/secret-manager?project=$PROJECT_ID"
echo ""
echo "   2. Add secret values for:"
for secret in $SECRETS; do
  echo "      - $secret"
done
echo ""
echo "   3. Push to GitHub to trigger deployment:"
echo "      git push origin main"
echo ""
echo "   4. Watch deployment:"
echo "      https://github.com/petwashglobal/petwash-marketplace/actions"
echo ""
echo "🌐 Your API will be available at:"
echo "   https://${SERVICE_NAME}-${PROJECT_ID}.${REGION}.run.app"
