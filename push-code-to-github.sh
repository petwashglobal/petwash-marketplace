#!/bin/bash

echo "🚀 Pushing Pet Wash code to GitHub..."
echo ""
echo "Repository: https://github.com/petwashglobal/petwash-marketplace"
echo ""

# Try to push
git push origin main 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Code pushed to GitHub!"
    echo ""
    echo "View your code at:"
    echo "https://github.com/petwashglobal/petwash-marketplace"
else
    echo ""
    echo "⚠️  Push failed. Let me try with the GitHub integration..."
    echo ""
    
    # Get GitHub token from Replit connector
    TOKEN=$(node -e "
    (async () => {
      const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
      const xReplitToken = process.env.REPL_IDENTITY 
        ? 'repl ' + process.env.REPL_IDENTITY 
        : process.env.WEB_REPL_RENEWAL 
        ? 'depl ' + process.env.WEB_REPL_RENEWAL 
        : null;

      const connectionSettings = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
        {
          headers: {
            'Accept': 'application/json',
            'X_REPLIT_TOKEN': xReplitToken
          }
        }
      ).then(res => res.json()).then(data => data.items?.[0]);

      const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
      console.log(accessToken);
    })();
    ")
    
    if [ -n "$TOKEN" ]; then
        echo "✅ Got GitHub token from integration"
        
        # Create authenticated URL
        git remote set-url origin "https://x-access-token:$TOKEN@github.com/petwashglobal/petwash-marketplace.git"
        
        # Push again
        git push origin main 2>&1
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ SUCCESS! Code pushed to GitHub!"
            echo ""
            echo "View your code at:"
            echo "https://github.com/petwashglobal/petwash-marketplace"
            
            # Reset URL to HTTPS
            git remote set-url origin "https://github.com/petwashglobal/petwash-marketplace.git"
        else
            echo ""
            echo "❌ Push failed. Please try using Replit's Git panel instead."
            echo ""
            echo "Steps:"
            echo "1. Click the Git icon (🌿) on the left sidebar"
            echo "2. Click 'Push' or 'Commit & Push'"
        fi
    else
        echo "❌ Could not get GitHub token"
        echo ""
        echo "Please use Replit's Git panel:"
        echo "1. Click the Git icon (🌿) on the left sidebar"
        echo "2. Click 'Push' or 'Commit & Push'"
    fi
fi

echo ""
