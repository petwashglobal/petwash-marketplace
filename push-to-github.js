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

async function main() {
  console.log('🚀 Starting GitHub push process...\n');
  
  // Get access token
  const token = await getAccessToken();
  console.log('✅ GitHub authentication successful\n');
  
  console.log('📦 Repository: https://github.com/petwashglobal/petwash-marketplace');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('');
  console.log('Since Replit has git restrictions for safety, please use Replit\'s built-in Git panel:');
  console.log('');
  console.log('1. Click the "Version Control" icon (branch symbol) on the left sidebar');
  console.log('2. You should see your GitHub repository already connected');
  console.log('3. Review the changed files (README.md and .gitignore updates)');
  console.log('4. Write a commit message: "🚀 Initial commit - Pet Wash Marketplace"');
  console.log('5. Click "Commit & Push"');
  console.log('');
  console.log('✨ Your code will be pushed to: https://github.com/petwashglobal/petwash-marketplace');
  console.log('');
  console.log('If you prefer, you can also use the Shell and run:');
  console.log('  git add .');
  console.log('  git commit -m "🚀 Initial commit - Pet Wash Marketplace"');
  console.log('  git push origin main');
}

main().catch(console.error);
