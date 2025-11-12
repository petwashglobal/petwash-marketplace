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

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function checkGitHubStatus() {
  try {
    console.log('🔍 Checking GitHub connection and repository status...\n');
    
    const octokit = await getGitHubClient();
    
    // Get authenticated user
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log('✅ GitHub Authentication: ACTIVE');
    console.log('👤 Account:', user.login);
    console.log('📧 Email:', user.email || 'support@petwash.co.il');
    console.log('');
    
    // Check if repository exists
    try {
      const { data: repo } = await octokit.rest.repos.get({
        owner: user.login,
        repo: 'petwash-marketplace'
      });
      
      console.log('✅ Repository Status: EXISTS');
      console.log('📦 Name:', repo.name);
      console.log('🔗 URL:', repo.html_url);
      console.log('👁️  Visibility:', repo.private ? 'Private' : 'Public');
      console.log('⭐ Stars:', repo.stargazers_count);
      console.log('📝 Description:', repo.description);
      console.log('');
      
      // Check branches
      const { data: branches } = await octokit.rest.repos.listBranches({
        owner: user.login,
        repo: 'petwash-marketplace'
      });
      
      console.log('🌿 Branches:', branches.map(b => b.name).join(', '));
      console.log('');
      
      // Get latest commits
      const { data: commits } = await octokit.rest.repos.listCommits({
        owner: user.login,
        repo: 'petwash-marketplace',
        per_page: 5
      });
      
      if (commits.length > 0) {
        console.log('📜 Recent Commits:');
        commits.forEach((commit, i) => {
          const date = new Date(commit.commit.author.date).toLocaleString();
          console.log(`   ${i + 1}. ${commit.commit.message}`);
          console.log(`      By: ${commit.commit.author.name} on ${date}`);
        });
        console.log('');
      } else {
        console.log('⚠️  No commits found - Repository is empty');
        console.log('');
        console.log('📋 Next Step: Push your code!');
        console.log('   Use Replit Git panel or run:');
        console.log('   git add .');
        console.log('   git commit -m "🚀 Initial commit"');
        console.log('   git push origin main');
        console.log('');
      }
      
      // Check files
      try {
        const { data: contents } = await octokit.rest.repos.getContent({
          owner: user.login,
          repo: 'petwash-marketplace',
          path: ''
        });
        
        if (Array.isArray(contents)) {
          console.log('📁 Files in Repository:');
          contents.slice(0, 10).forEach(file => {
            console.log(`   - ${file.name} (${file.type})`);
          });
          if (contents.length > 10) {
            console.log(`   ... and ${contents.length - 10} more files`);
          }
        }
      } catch (e) {
        console.log('📁 Files: Repository appears to be empty');
      }
      
      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log('✅ GITHUB STATUS: FULLY CONNECTED & ACTIVE');
      console.log('═══════════════════════════════════════════');
      
    } catch (error) {
      if (error.status === 404) {
        console.log('⚠️  Repository "petwash-marketplace" not found');
        console.log('Would you like me to create it?');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

checkGitHubStatus().catch(console.error);
