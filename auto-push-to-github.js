import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import fs from 'fs';

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

async function pushToGitHub() {
  console.log('🚀 Connecting to GitHub and pushing your code...\n');
  
  try {
    // Get token
    const token = await getAccessToken();
    console.log('✅ GitHub authentication successful');
    
    // Configure git with token
    const repoUrl = `https://x-access-token:${token}@github.com/petwashglobal/petwash-marketplace.git`;
    
    console.log('📝 Configuring git remote...');
    execSync('git remote remove origin', { stdio: 'ignore' }).toString();
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'pipe' }).toString();
    
    console.log('📦 Pushing all code to GitHub...');
    
    // Push to GitHub
    const output = execSync('git push -u origin main --force 2>&1', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('\n✅ SUCCESS! All code pushed to GitHub!\n');
    console.log('🔗 View your repository:');
    console.log('   https://github.com/petwashglobal/petwash-marketplace\n');
    
    // Reset to HTTPS URL (remove token)
    execSync('git remote remove origin', { stdio: 'ignore' });
    execSync('git remote add origin https://github.com/petwashglobal/petwash-marketplace.git', { stdio: 'pipe' });
    
    console.log('═══════════════════════════════════════════════');
    console.log('✅ GITHUB CONNECTED & CODE TRANSFERRED');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('Your Pet Wash code is now on GitHub!');
    console.log('Repository: petwashglobal/petwash-marketplace');
    console.log('');
    console.log('Next step: Deploy your live site');
    console.log('Click the "Publish" button in Replit to go live!');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nDetails:', error.stderr || error.stdout || '');
    throw error;
  }
}

pushToGitHub().catch(err => {
  console.error('Failed to push:', err);
  process.exit(1);
});
