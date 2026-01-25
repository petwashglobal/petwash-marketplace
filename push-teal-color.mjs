import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

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

  // Read the updated local file
  const content = fs.readFileSync('/home/runner/workspace/client/src/components/PetWashDivisions.tsx', 'utf-8');
  
  console.log('Fetching current file from GitHub...');
  const { data: fileData } = await octokit.repos.getContent({
    owner, repo,
    path: 'client/src/components/PetWashDivisions.tsx',
    ref: branch
  });
  
  console.log('Updating Academy color from purple to teal...');
  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: 'client/src/components/PetWashDivisions.tsx',
    message: 'Change Academy color from purple to teal (user preference)',
    content: Buffer.from(content).toString('base64'),
    sha: fileData.sha,
    branch
  });
  
  console.log('SUCCESS! Academy now uses teal color');
}

main().catch(err => console.error('Error:', err.message));
