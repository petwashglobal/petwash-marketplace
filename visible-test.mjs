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

  // Change the HTML title to a unique value we can detect
  console.log('Fetching client/index.html...');
  const { data: fileData } = await octokit.repos.getContent({
    owner, repo,
    path: 'client/index.html',
    ref: branch
  });
  
  let content = Buffer.from(fileData.content, 'base64').toString('utf-8');
  const testMarker = 'TEST_BUILD_' + Date.now();
  
  // Add a meta tag we can detect
  if (!content.includes('data-test-build')) {
    content = content.replace('<head>', `<head>\n    <meta name="data-test-build" content="${testMarker}">`);
  } else {
    content = content.replace(/content="TEST_BUILD_[^"]*"/, `content="${testMarker}"`);
  }
  
  console.log('Adding test marker:', testMarker);
  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: 'client/index.html',
    message: 'ADD VISIBLE TEST MARKER: ' + testMarker,
    content: Buffer.from(content).toString('base64'),
    sha: fileData.sha,
    branch
  });
  
  console.log('SUCCESS! Test marker added:', testMarker);
  console.log('After deploy, check for:', testMarker);
}

main().catch(err => console.error('Error:', err.message));
