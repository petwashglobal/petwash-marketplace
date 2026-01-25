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

  try {
    // Trigger workflow_dispatch to run the CI manually
    console.log('Triggering workflow dispatch...');
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: 'petwash-ci.yml',
      ref: branch
    });
    console.log('SUCCESS! Triggered workflow dispatch');
  } catch (error) {
    console.log('Workflow dispatch error:', error.message);
    console.log('Trying file update instead...');
    
    // Fallback: Update a simple file to trigger build
    const { data: fileData } = await octokit.repos.getContent({
      owner, repo,
      path: 'client/src/main.tsx',
      ref: branch
    });
    
    let content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const timestamp = new Date().toISOString();
    content = content.replace(/\/\/ Build trigger:.*/g, '');
    content = '// Build trigger: ' + timestamp + '\n' + content;
    
    await octokit.repos.createOrUpdateFileContents({
      owner, repo,
      path: 'client/src/main.tsx',
      message: 'Trigger fresh build - ' + timestamp,
      content: Buffer.from(content).toString('base64'),
      sha: fileData.sha,
      branch
    });
    console.log('SUCCESS! Triggered build via file update');
  }
}

main().catch(err => console.error('Error:', err.message));
