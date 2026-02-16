# Deployment Instructions for agent.orcest.ai

## Changes Made

### 1. OpenRouter Configuration
- **File**: `src/vs/workbench/contrib/void/common/modelCapabilities.ts`
- **Change**: Pre-configured OpenRouter with the provided API key
- **API Key**: `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`
- **Default Models**: 
  - `anthropic/claude-opus-4` (recommended - most capable)
  - `anthropic/claude-sonnet-4` (fast and capable)
  - `qwen/qwen3-235b-a22b` (large open model)
  - `deepseek/deepseek-r1` (reasoning model)

### 2. Removed Connection Token Requirement
- **File**: `Dockerfile`
- **Change**: Added `--without-connection-token` flag to server startup
- **Result**: Direct access to https://agent.orcest.ai without `/login` redirect

### 3. Render.com Deployment Configuration
- **File**: `render.yaml`
- **Configuration**:
  - Service type: Web
  - Environment: Docker
  - Branch: `cursor/500-7c57`
  - Port: 10000
  - Auto-deploy: Enabled

## Deployment to Render.com

### Option 1: Auto-Deploy (Recommended)
If your Render.com service is configured with auto-deploy:
1. The changes are already pushed to branch `cursor/500-7c57`
2. Render.com will automatically detect the push and start building
3. Wait for the build to complete (typically 10-15 minutes)
4. The service will be live at https://agent.orcest.ai

### Option 2: Manual Deploy via Dashboard
1. Go to https://dashboard.render.com
2. Find your `ide-orcest-ai` service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Select branch `cursor/500-7c57`
5. Click "Deploy"

### Option 3: Manual Deploy via CLI
```bash
# Install Render CLI if not already installed
brew tap render-com/render
brew install render

# Login to Render
render login

# Trigger deployment
render deploy
```

## Verification

After deployment, verify the following:

1. **Direct Access**: Navigate to https://agent.orcest.ai
   - Should load directly without redirecting to /login

2. **OpenRouter Configuration**: 
   - Open Void IDE
   - Go to Settings (⚙️)
   - Check AI Provider settings
   - OpenRouter should be pre-configured with the API key
   - Models should be available for selection

3. **Test AI Functionality**:
   - Try using the AI assistant (Cmd/Ctrl + L)
   - Select an OpenRouter model
   - Send a test message
   - Should receive a response without 500 errors

## Troubleshooting

### Still Getting 500 Error
If you still see 500 errors:
1. Check Render.com build logs for errors
2. Ensure the Docker build completed successfully
3. Check runtime logs for any startup errors
4. Verify the API key is valid at https://openrouter.ai/settings/keys

### Can't Access Without /login
If redirect still occurs:
1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Check Render.com environment variables
4. Verify the `--without-connection-token` flag is in the startup command

### API Key Issues
If OpenRouter requests fail:
1. Verify API key at https://openrouter.ai/settings/keys
2. Check account balance/credits
3. Review rate limits at https://openrouter.ai/docs/api-reference/limits

## Security Note

The API key is currently hardcoded in the source. For production use, consider:
1. Moving the API key to Render.com environment variables
2. Implementing user-specific API key configuration
3. Setting up usage limits and monitoring

## Support

For issues or questions:
- Check Render.com logs: https://dashboard.render.com
- Review OpenRouter status: https://openrouter.ai/docs
- Void Editor documentation: https://voideditor.com
