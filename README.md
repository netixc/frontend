# Voice Chat - Frontend

Real-time voice chat interface with web and native macOS menubar app support.

## Features

- 🎤 Real-time voice streaming
- 🔊 Text-to-Speech playback
- 💬 Chat history
- ⚙️ Settings UI for backend configuration
- 🖥️ Web app or macOS menubar app

## Quick Start

```bash
npm install

# Web app
npm run dev              # Development at http://localhost:3000
npm run build            # Production build to dist/

# macOS menubar app
npm run tauri:dev        # Development with hot reload
npm run tauri:build      # Production build
```

## Configuration

Click the settings icon (⚙️) in the app to configure your backend URL. Settings are saved in localStorage.

Alternatively, edit `public/config.js`:
```javascript
window.APP_CONFIG = {
  backendUrl: 'localhost:8000',
  autoProtocol: true
};
```

## macOS Menubar App

The Tauri menubar app:
- Lives in menubar (no dock icon)
- Shows/hides window on click
- Auto-hides when losing focus
- ~5MB bundle size

Built app located at `src-tauri/target/release/bundle/macos/`

## Deployment

### Web App
1. `npm run build`
2. Deploy `dist/` folder to any static host
3. Edit `dist/config.js` for backend URL

### macOS App
1. `npm run tauri:build`
2. Distribute the `.app` from `src-tauri/target/release/bundle/macos/`
