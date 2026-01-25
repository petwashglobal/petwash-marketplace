import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

let connectionSettings = null;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
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

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) throw new Error('GitHub not connected');
  return accessToken;
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const owner = 'petwashglobal';
  const repo = 'petwash-marketplace';
  const branch = 'main';

  console.log('Pushing missing hooks file to GitHub...');

  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/' + branch });
  const latestCommitSha = ref.object.sha;
  console.log('Latest commit:', latestCommitSha);

  const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  const treeSha = commit.tree.sha;

  const files = [
    { path: 'client/src/hooks/useScrollReveal.ts', localPath: '/home/runner/workspace/client/src/hooks/useScrollReveal.ts' },
  ];

  const blobs = [];
  for (const file of files) {
    const content = fs.readFileSync(file.localPath, 'utf-8');
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64',
    });
    blobs.push({ path: file.path, sha: blob.sha, mode: '100644', type: 'blob' });
    console.log('Created blob for ' + file.path);
  }

  const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: treeSha, tree: blobs });
  console.log('Created tree:', newTree.sha);

  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message: 'Add missing useScrollReveal hook',
    tree: newTree.sha,
    parents: [latestCommitSha],
  });
  console.log('Created commit:', newCommit.sha);

  await octokit.git.updateRef({ owner, repo, ref: 'heads/' + branch, sha: newCommit.sha });
  console.log('SUCCESS! Missing file pushed to GitHub');
  console.log('Commit: https://github.com/petwashglobal/petwash-marketplace/commit/' + newCommit.sha);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
