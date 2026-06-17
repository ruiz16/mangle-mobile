import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const terminalLogPlugin = () => ({
  name: 'terminal-log',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/log' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          console.log('\x1b[36m[Frontend Log]\x1b[0m', body);
          res.statusCode = 200;
          res.end('ok');
        });
      } else {
        next();
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), terminalLogPlugin()],
  server: {
    allowedHosts: ['15bd-161-10-244-216.ngrok-free.app']
  },
});
