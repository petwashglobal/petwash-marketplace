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
  const owner = 'petwashglobal', repo = 'petwash-marketplace', branch = 'main';

  // Delete dist folder from GitHub to prevent confusion
  console.log('Removing dist folder from GitHub...');
  
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/' + branch });
  const latestCommitSha = ref.object.sha;
  
  const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  const treeSha = commit.tree.sha;
  
  // Create a tree that deletes the dist folder by not including it
  const { data: currentTree } = await octokit.git.getTree({ owner, repo, tree_sha: treeSha });
  const newTreeItems = currentTree.tree.filter(item => item.path !== 'dist');
  
  const { data: newTree } = await octokit.git.createTree({ owner, repo, tree: newTreeItems });
  
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message: 'Remove dist folder - let CI build fresh with Academy',
    tree: newTree.sha,
    parents: [latestCommitSha],
  });
  
  await octokit.git.updateRef({ owner, repo, ref: 'heads/' + branch, sha: newCommit.sha });
  console.log('SUCCESS! Removed dist folder, CI will build fresh');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
