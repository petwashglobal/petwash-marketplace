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

  // Modify App.tsx to force a new bundle hash
  console.log('Fetching client/src/App.tsx...');
  const { data: fileData } = await octokit.repos.getContent({
    owner, repo,
    path: 'client/src/App.tsx',
    ref: branch
  });
  
  let content = Buffer.from(fileData.content, 'base64').toString('utf-8');
  const timestamp = Date.now();
  
  // Add a console log with timestamp to force new bundle content
  if (!content.includes('// BUILD_FORCE_REBUILD')) {
    // Add after imports
    const importEnd = content.lastIndexOf('import');
    const nextLine = content.indexOf('\n', importEnd);
    content = content.slice(0, nextLine + 1) + 
      '\n// BUILD_FORCE_REBUILD: ' + timestamp + '\nconsole.log("Build: ' + timestamp + '");\n' + 
      content.slice(nextLine + 1);
  } else {
    content = content.replace(/\/\/ BUILD_FORCE_REBUILD:.*/g, '// BUILD_FORCE_REBUILD: ' + timestamp);
    content = content.replace(/console\.log\("Build:.*/g, 'console.log("Build: ' + timestamp + '");');
  }
  
  console.log('Adding JS timestamp:', timestamp);
  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: 'client/src/App.tsx',
    message: 'FORCE JS REBUILD: ' + timestamp,
    content: Buffer.from(content).toString('base64'),
    sha: fileData.sha,
    branch
  });
  
  console.log('SUCCESS! JS rebuild forced with timestamp:', timestamp);
}

main().catch(err => console.error('Error:', err.message));
