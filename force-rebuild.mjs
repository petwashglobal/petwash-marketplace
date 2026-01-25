import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

let connectionSettings = null;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);
  return connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  const owner = 'petwashglobal';
  const repo = 'petwash-marketplace';
  const branch = 'main';

  // Get current file
  const { data: fileData } = await octokit.repos.getContent({
    owner, repo,
    path: 'client/src/main.tsx',
    ref: branch
  });
  
  let content = Buffer.from(fileData.content, 'base64').toString('utf-8');
  
  // Add timestamp comment to force cache bust
  const timestamp = new Date().toISOString();
  if (content.includes('// Cache bust:')) {
    content = content.replace(/\/\/ Cache bust:.*\n/, '// Cache bust: ' + timestamp + '\n');
  } else {
    content = '// Cache bust: ' + timestamp + '\n' + content;
  }

  // Update file
  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: 'client/src/main.tsx',
    message: 'Force rebuild with Academy - ' + timestamp,
    content: Buffer.from(content).toString('base64'),
    sha: fileData.sha,
    branch
  });

  console.log('SUCCESS! Triggered rebuild with new timestamp: ' + timestamp);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
