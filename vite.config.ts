import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      optimizeDeps: {
        include: [
          '@vue-flow/core',
          '@vue-flow/controls',
          '@vue-flow/background',
          '@vue-flow/minimap',
          'dagre',
        ],
      },
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://localhost:5320/api',
            ws: true,
          },
        },
      },
    },
  };
});
