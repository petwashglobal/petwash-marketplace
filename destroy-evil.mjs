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
  const owner = 'petwashglobal', repo = 'petwash-marketplace', branch = 'main';

  // Delete old deploy.yml
  console.log('Getting old deploy.yml...');
  const { data: fileData } = await octokit.repos.getContent({
    owner, repo,
    path: '.github/workflows/deploy.yml',
    ref: branch
  });

  console.log('DESTROYING deploy.yml...');
  await octokit.repos.deleteFile({
    owner, repo,
    path: '.github/workflows/deploy.yml',
    message: '🔥 DESTROY old deploy.yml - only petwash-ci.yml should deploy',
    sha: fileData.sha,
    branch
  });

  console.log('✅ OLD EVIL WORKFLOW DESTROYED!');
  console.log('Now only petwash-ci.yml will deploy to Firebase');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
