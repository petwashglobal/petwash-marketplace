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

  // Get App.tsx to add a visible marker
  const { data: fileData } = await octokit.repos.getContent({
    owner, repo,
    path: 'client/src/App.tsx',
    ref: branch
  });
  
  let content = Buffer.from(fileData.content, 'base64').toString('utf-8');
  
  // Add a data-version attribute we can detect
  const buildVersion = 'BUILD_2026_01_25_' + Date.now();
  if (!content.includes('data-build-version')) {
    content = content.replace('<div className="app">', `<div className="app" data-build-version="${buildVersion}">`);
    if (!content.includes('data-build-version')) {
      // Try different pattern
      content = content.replace(/<div/i, `<div data-build-version="${buildVersion}"`);
    }
  } else {
    content = content.replace(/data-build-version="[^"]*"/, `data-build-version="${buildVersion}"`);
  }

  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: 'client/src/App.tsx',
    message: 'Add build version marker ' + buildVersion,
    content: Buffer.from(content).toString('base64'),
    sha: fileData.sha,
    branch
  });

  console.log('SUCCESS! Added build version marker: ' + buildVersion);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
