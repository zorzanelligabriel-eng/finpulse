import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, o Vite repassa /api e /ws para o back-end.
// Assim o front usa caminhos relativos e não precisa saber a porta da API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
      '/ws': { target: 'ws://localhost:3333', ws: true },
    },
  },
});
