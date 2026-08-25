# Multiplayer Deployment Guide for SPP RETRORUSH DRIVE

## Quick Start with Render.com (Recommended)

### Step 1: Sign Up on Render
1. Go to https://render.com
2. Click "Sign up"
3. Choose **"GitHub"** to sign in with your GitHub account
4. Authorize Render to access your repositories

### Step 2: Create a Web Service
1. In the Render dashboard, click **"+ New"** → **"Web Service"**
2. Select **"Build and deploy from a Git repository"**
3. Click **"Connect account"** and authorize GitHub
4. Search for and select: `SPPRETRORUSHDRIVE.github.io`

### Step 3: Configure the Service
Fill in these settings:
- **Name**: `spp-retrorush-drive` (or any name you prefer)
- **Environment**: `Node`
- **Region**: Choose the closest to you
- **Branch**: `main`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Click **"Free"** to use the free tier

### Step 4: Add Environment Variables
1. Scroll down to **"Environment"**
2. Click **"Add Environment Variable"**
3. Add these two:
   - **Key**: `NODE_ENV` → **Value**: `production`
   - **Key**: `ORIGIN` → **Value**: `*` (or your website URL for security)

### Step 5: Deploy
1. Click **"Create Web Service"**
2. Render will start building and deploying automatically
3. Wait for it to show "live" (takes 1-3 minutes)
4. Copy your service URL (e.g., `https://spp-retrorush-drive.onrender.com`)

### Step 6: Update Your Game Client
1. In your repository, find the multiplayer.js file
2. Look for this line near the top:
   ```javascript
   const SERVER_URL = window.location.hostname === 'localhost' 
     ? 'http://localhost:3000'
     : 'https://spp-retrorush-drive.onrender.com'; // Replace this with your Render URL
   ```
3. Replace `https://spp-retrorush-drive.onrender.com` with your actual Render URL
4. Commit and push the change
5. Render will automatically redeploy when you push

## How to Connect GitHub to Render

**When you sign up with GitHub OAuth:**
1. Render gets permission to read your repositories
2. You can then select any of your public or private repos
3. Every time you push to the branch you selected (usually `main`), Render automatically redeploys
4. No need to manually deploy — it happens automatically!

## Testing the Connection

1. Open your game at https://tabrishi.github.io/SPPRETRORUSHDRIVE.github.io/
2. Press **F12** to open Developer Console
3. Go to the **Console** tab
4. Look for messages like:
   - `[Multiplayer] Connected to server: ...` ✅ Connection successful
   - `[Multiplayer] Connection error: ...` ❌ Check your server URL in multiplayer.js

## Features Now Available

✅ **Create Multiplayer Rooms** — Press "CREATE PARTY" to host a race
✅ **Join Friends** — Use 6-character room codes to join
✅ **Real-time Updates** — See players join/leave instantly
✅ **Leaderboard Persistence** — Race results saved to database
✅ **Multiplayer Races** — Up to 16 players in one race

## Troubleshooting

### "Connection refused" or "Failed to connect"
- Make sure your Render URL is correct in `multiplayer.js`
- Check that Render says "live" in the dashboard
- Try refreshing the page

### CORS errors in console
- Render might have the wrong `ORIGIN` setting
- Set `ORIGIN=*` to allow all domains during testing

### Database errors
- Render may be running on a read-only filesystem
- The server handles this gracefully, but races may not persist
- Consider upgrading to a paid tier for full persistence

## Alternative Deployment Options

### Railway.app
1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub
4. Select your repo
5. Railway auto-detects Node and deploys
6. Get your URL and update multiplayer.js

### Heroku (Paid)
Heroku removed free tier in 2022, but if using:
1. https://heroku.com
2. Create app → Connect GitHub
3. Enable auto-deploys
4. Set buildpack to Node.js

## Questions?
Check Socket.IO docs: https://socket.io/docs/
Render support: https://render.com/docs
