// Runtime Configuration
// You can edit this file to point to a different backend without rebuilding
window.APP_CONFIG = {
  // Backend URL (without protocol)
  // Examples:
  //   - 'localhost:8000' (local development)
  //   - '192.168.1.100:8000' (local network)
  //   - 'your-backend.example.com' (production server)
  backendUrl: 'localhost:8000',

  // Auto-detect protocol based on current page
  // Set to true to use same protocol as the page (http/https)
  // Set to false to always use ws:// (not recommended for production)
  autoProtocol: true
};
