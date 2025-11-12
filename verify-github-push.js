import { Octokit } from '@octokit/rest';

let connectionSettings;

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

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function checkGitHubPush() {
  try {
    const octokit = new Octokit({ auth: await getAccessToken() });
    
    const { data: repo } = await octokit.rest.repos.get({
      owner: 'petwashglobal',
      repo: 'petwash-marketplace'
    });
    
    console.log('✅ GitHub Repository: CONNECTED');
    console.log('🔗 URL:', repo.html_url);
    console.log('');
    
    try {
      const { data: commits } = await octokit.rest.repos.listCommits({
        owner: 'petwashglobal',
        repo: 'petwash-marketplace',
        per_page: 3
      });
      
      if (commits.length > 0) {
        console.log('✅ CODE PUSHED TO GITHUB!');
        console.log('');
        console.log('📜 Latest commits:');
        commits.forEach((commit, i) => {
          console.log(`   ${i + 1}. ${commit.commit.message}`);
        });
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('🎉 SUCCESS! YOUR CODE IS ON GITHUB!');
        console.log('═══════════════════════════════════════════');
        console.log('');
        console.log('🚀 NEXT STEP: Deploy Your Live Website');
        console.log('');
        console.log('Click the "Publish" button in Replit to go live!');
        console.log('');
      }
    } catch (e) {
      if (e.status === 409) {
        console.log('⚠️  Repository exists but no code pushed yet');
        console.log('');
        console.log('Please click "Push" in the Git panel to upload your code.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkGitHubPush();
