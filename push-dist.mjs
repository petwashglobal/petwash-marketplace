import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

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

function getAllFiles(dir, fileList = [], basePath = dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList, basePath);
    } else {
      fileList.push({
        path: path.relative(basePath, filePath),
        fullPath: filePath
      });
    }
  }
  return fileList;
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const owner = 'petwashglobal';
  const repo = 'petwash-marketplace';
  const branch = 'main';

  console.log('Reading dist/public directory...');
  const distPath = '/home/runner/workspace/dist/public';
  const files = getAllFiles(distPath);
  console.log('Found ' + files.length + ' files to upload');

  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/' + branch });
  const latestCommitSha = ref.object.sha;
  console.log('Latest commit:', latestCommitSha);

  const { data: commit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
  const treeSha = commit.tree.sha;

  const blobs = [];
  let count = 0;
  for (const file of files) {
    const content = fs.readFileSync(file.fullPath);
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: content.toString('base64'),
      encoding: 'base64',
    });
    blobs.push({ 
      path: 'dist/public/' + file.path.replace(/\\/g, '/'), 
      sha: blob.sha, 
      mode: '100644', 
      type: 'blob' 
    });
    count++;
    if (count % 20 === 0) console.log('Uploaded ' + count + '/' + files.length + ' files');
  }
  console.log('Uploaded all ' + count + ' files');

  const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: treeSha, tree: blobs });
  console.log('Created tree:', newTree.sha);

  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message: 'Deploy pre-built dist with Pet Wash Academy',
    tree: newTree.sha,
    parents: [latestCommitSha],
  });
  console.log('Created commit:', newCommit.sha);

  await octokit.git.updateRef({ owner, repo, ref: 'heads/' + branch, sha: newCommit.sha });
  console.log('SUCCESS! Pre-built dist pushed to GitHub');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
