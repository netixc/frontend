# Realtime Voice Chat - Frontend

A standalone frontend for the Realtime Voice Chat application. This can be deployed separately from the backend server and later converted into a macOS menubar app.

## Features

- 🎤 Real-time voice input with WebSocket streaming
- 🔊 Text-to-Speech playback
- 💬 Chat interface with conversation history
- ⚙️ Configurable backend URL (no rebuild required)
- 🚀 Fast development with Vite
- 📦 Ready for conversion to macOS menubar app (Electron/Tauri)

## Prerequisites

- Node.js 18+ and npm
- A running backend server (see main project README)

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server (http://localhost:3000)
npm run dev
```

The dev server will automatically open in your browser and provide hot module reloading for instant updates.

## Building for Production

```bash
# Build for production
npm run build
```

This creates an optimized build in the `dist/` folder ready for deployment.

```bash
# Preview the production build locally
npm run preview
```

## Configuration

### Backend URL

You can configure the backend URL in two ways:

1. **Using the Settings UI** (recommended):
   - Click the gear icon (⚙️) in the app
   - Enter your backend URL (without protocol)
   - Click "Save Settings"
   - Settings are stored in your browser's localStorage

2. **Edit `public/config.js`** (sets the default):
   ```javascript
   window.APP_CONFIG = {
     // Backend URL (without protocol)
     backendUrl: 'localhost:8000',  // Change this to your backend server

     // Auto-detect protocol (true = use same as page, false = always ws://)
     autoProtocol: true
   };
   ```

**Examples:**
- Local development: `'localhost:8000'`
- Local network: `'192.168.1.100:8000'`
- Production server: `'api.example.com'` or `'api.example.com:8000'`

**Important:** You can edit `config.js` in the `dist/` folder after building without needing to rebuild!

## Deployment

### Static Hosting (Vercel, Netlify, etc.)

1. Build the project: `npm run build`
2. Deploy the `dist/` folder to your hosting provider
3. Edit `dist/config.js` to point to your backend server

### Self-Hosting (nginx, Apache, etc.)

1. Build the project: `npm run build`
2. Copy `dist/` contents to your web server
3. Configure your web server to serve `index.html` for all routes
4. Edit `config.js` to match your backend URL

### Example nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/voice-chat;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: Proxy WebSocket to backend on same domain
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Project Structure

```
frontend/
├── index.html              # Entry point
├── src/
│   └── app.js             # Main application logic
├── public/                # Static assets (copied to dist/)
│   ├── config.js          # Runtime configuration
│   ├── pcmWorkletProcessor.js    # Audio capture worklet
│   ├── ttsPlaybackProcessor.js   # Audio playback worklet
│   ├── background.jpg
│   └── favicon.ico
├── package.json
├── vite.config.js
└── README.md
```

## Future: macOS Menubar App

This frontend is designed to be easily converted into a macOS menubar app using:

- **Electron**: Full-featured, larger bundle size
- **Tauri**: Rust-based, smaller bundle size, better performance

The current architecture (runtime config, modular code) makes this conversion straightforward.

## Troubleshooting

### WebSocket connection fails

1. Check that your backend server is running
2. Verify `public/config.js` has the correct backend URL
3. Check browser console for connection errors
4. Ensure backend CORS settings allow your frontend domain

### Audio not working

1. Grant microphone permissions in your browser
2. Use HTTPS in production (required for microphone access)
3. Check browser console for audio worklet errors

### Build fails

1. Delete `node_modules/` and run `npm install` again
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Ensure you're using Node.js 18 or higher

## Development Tips

- The dev server runs on `http://localhost:3000` by default
- Hot module reloading works for all files except audio worklets
- Check browser console for connection logs (includes backend URL)
- Backend must have CORS enabled for development

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## License

Same as parent project.
