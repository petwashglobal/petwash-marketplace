import { Octokit } from '@octokit/rest';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? 'repl ' + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? 'depl ' + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');
  return await fetch('https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github', {
    headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken }
  }).then(res => res.json()).then(data => data.items?.[0]?.settings?.access_token || data.items?.[0]?.settings?.oauth?.credentials?.access_token);
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  const owner = 'petwashglobal';
  const repo = 'petwash-marketplace';
  const branch = 'main';
  const path = '.github/workflows/petwash-ci.yml';

  const newWorkflow = `name: PetWash CI 2025 - Deploy to Firebase

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    env:
      VITE_FIREBASE_API_KEY: \${{ secrets.VITE_FIREBASE_API_KEY }}
      VITE_FIREBASE_AUTH_DOMAIN: \${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
      VITE_FIREBASE_PROJECT_ID: \${{ secrets.VITE_FIREBASE_PROJECT_ID }}
      VITE_FIREBASE_STORAGE_BUCKET: \${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
      VITE_FIREBASE_MESSAGING_SENDER_ID: \${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
      VITE_FIREBASE_APP_ID: \${{ secrets.VITE_FIREBASE_APP_ID }}
      VITE_FIREBASE_MEASUREMENT_ID: \${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
      VITE_RECAPTCHA_SITE_KEY: \${{ secrets.VITE_RECAPTCHA_SITE_KEY }}
      VITE_WEBAUTHN_RP_ID: \${{ secrets.VITE_WEBAUTHN_RP_ID }}
      VITE_GOOGLE_MAPS_API_KEY: \${{ secrets.VITE_GOOGLE_MAPS_API_KEY }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node 20
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Fresh dependency setup
        run: rm -rf node_modules && npm ci

      - name: Clean dist folder
        run: rm -rf dist/

      - name: Build production bundle
        run: npm run build
        
      - name: DEBUG - Verify Academy in build
        run: |
          echo "=== Checking for Academy in build ==="
          grep -r "Academy" dist/public/assets/*.js | head -3 || echo "NO ACADEMY FOUND!"
          echo "=== Main bundle file ==="
          ls -la dist/public/assets/index*.js | head -1
          echo "=== Search for divisions ==="
          grep -r "divisions" dist/public/assets/*.js | head -3 || echo "NO divisions!"

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GOOGLE_APPLICATION_CREDENTIALS_JSON }}

      - name: Set up gcloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: signinpetwash

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: \${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: \${{ secrets.GOOGLE_APPLICATION_CREDENTIALS_JSON }}
          projectId: signinpetwash
          channelId: live
`;

  try {
    console.log('Fetching current file...');
    const { data: fileData } = await octokit.repos.getContent({
      owner, repo, path, ref: branch
    });
    console.log('Current SHA:', fileData.sha);

    console.log('Updating file...');
    await octokit.repos.createOrUpdateFileContents({
      owner, repo, path,
      message: 'DEBUG: Add verification to find Academy in build output',
      content: Buffer.from(newWorkflow).toString('base64'),
      sha: fileData.sha,
      branch
    });
    console.log('SUCCESS! Updated workflow with debug output');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Status:', error.status);
  }
}

main();
