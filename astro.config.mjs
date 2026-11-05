// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// Se publica en GitHub Pages: https://r354t0.github.io/CCNA_4Dummies/
export default defineConfig({
  site: 'https://r354t0.github.io',
  base: '/CCNA_4Dummies',
  integrations: [mdx(), react()],
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: false },
  },
});
