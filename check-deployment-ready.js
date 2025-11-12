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
  return accessToken;
}

async function checkStatus() {
  try {
    const octokit = new Octokit({ auth: await getAccessToken() });
    
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: 'petwashglobal',
      repo: 'petwash-marketplace',
      per_page: 1
    });
    
    console.log('═══════════════════════════════════════════');
    console.log('📊 DEPLOYMENT STATUS CHECK');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('✅ GitHub: Connected');
    console.log('✅ Repository: petwashglobal/petwash-marketplace');
    console.log('');
    console.log('📜 Latest commit:');
    console.log(`   "${commits[0].commit.message}"`);
    console.log(`   By: ${commits[0].commit.author.name}`);
    console.log(`   Date: ${new Date(commits[0].commit.author.date).toLocaleString()}`);
    console.log('');
    
    // Check if fix is pushed
    const fixMessage = commits[0].commit.message.toLowerCase();
    if (fixMessage.includes('fix') || fixMessage.includes('import') || fixMessage.includes('luxury')) {
      console.log('✅ Import fix appears to be pushed!');
      console.log('');
      console.log('🚀 READY TO DEPLOY!');
      console.log('');
      console.log('Next step:');
      console.log('1. Click the "Publish" button in Replit (top right)');
      console.log('2. Choose "Autoscale Deployment"');
      console.log('3. Click "Publish"');
      console.log('');
      console.log('Your site will be live in 2-3 minutes!');
    } else {
      console.log('⚠️  Import fix not yet pushed');
      console.log('');
      console.log('Please push the latest changes:');
      console.log('1. Click Git icon (🌿) in left sidebar');
      console.log('2. Click "Push" button');
      console.log('3. Then try deployment again');
    }
    console.log('');
    console.log('═══════════════════════════════════════════');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkStatus();
