import { Octokit } from '@octokit/rest';

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
  
  // Trigger workflow dispatch
  console.log('Triggering fresh deployment workflow...');
  await octokit.actions.createWorkflowDispatch({
    owner: 'petwashglobal',
    repo: 'petwash-marketplace',
    workflow_id: 'petwash-ci.yml',
    ref: 'main'
  });
  console.log('SUCCESS! Deployment workflow triggered.');
  console.log('Check: https://github.com/petwashglobal/petwash-marketplace/actions');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
