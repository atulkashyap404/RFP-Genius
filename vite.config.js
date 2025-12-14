import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // This makes the API key available in your app as process.env.API_KEY
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    // This ensures that the dev server can find and serve the pdf.worker.js file
    // which is needed for processing PDFs in the browser.
    server: {
      fs: {
        allow: ['.', 'node_modules/pdfjs-dist/build/']
      }
    }
  };
});
