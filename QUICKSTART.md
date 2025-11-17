# Quick Start Guide

## First Time Setup

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start dev server (opens http://localhost:3000)
npm run dev
```

## Configure Backend URL

You can configure the backend URL in two ways:

1. **Using the Settings UI** (recommended):
   - Click the gear icon in the app
   - Enter your backend URL (e.g., `localhost:8000`)
   - Settings are saved in your browser

2. **Edit `public/config.js`** (optional default):
   ```javascript
   window.APP_CONFIG = {
     backendUrl: 'localhost:8000',  // ← Your backend server
     autoProtocol: true
   };
   ```

## Production Build

```bash
# Build optimized version
npm run build

# Preview the build
npm run preview
```

Built files go to `dist/` folder.

## Deploy

After building, you can:
1. Copy `dist/` folder anywhere
2. Serve with any web server (nginx, Apache, etc.)
3. Upload to static hosting (Vercel, Netlify, etc.)

**Pro tip:** Edit `dist/config.js` to change backend URL without rebuilding!

## Full Documentation

See [README.md](./README.md) for complete documentation.
