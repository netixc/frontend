import { defineConfig } from 'vite';

export default defineConfig({
  // Server configuration for development
  server: {
    port: 3000,
    open: true,
    // Enable CORS for development
    cors: true
  },

  // Build configuration
  build: {
    outDir: 'dist',
    // Generate sourcemaps for easier debugging
    sourcemap: true,
    // Optimize chunks
    rollupOptions: {
      output: {
        // Separate vendor chunks for better caching
        manualChunks: undefined
      }
    }
  },

  // Public directory (files copied as-is to dist)
  publicDir: 'public',

  // Base path for deployment
  base: './'
});
