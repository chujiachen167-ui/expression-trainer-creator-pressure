#!/usr/bin/env node
/** Build a browser-only static tree for Cloudflare Pages (scheme C).
 *  Dashboard: build command `node scripts/package-web.js`, output `dist`,
 *  env SKIP_DEPENDENCY_INSTALL=1 so Pages does not npm-install Electron/Sherpa.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const defaultRoot = path.resolve(__dirname, '..');

const pages = [
  'index.html',
  'v1-camera-baseline.html',
  'v2-ai-audience.html',
  'v3-creator-studio.html',
  'contact.html'
];

const rootFiles = [
  'shared.css',
  'contact-carousel.css',
  'drift-wall.css',
  'i18n.js',
  'creator-project-config.js',
  'brand-logo.js',
  'product-shell.js',
  'launcher-logo-motion.js',
  'vertical-marquee-config.js',
  'qa-element-editor.js',
  'config-file-store.js',
  'control-panel.js',
  'launcher-transcript.js',
  'launcher-text-effects.js',
  'launcher-scroll-expand.js',
  'expression-analysis.js',
  'v1-controls.js',
  'v1-topic-picker.js',
  'audience-templates.js',
  'avatar-provider.js',
  'stt-audio.js',
  'media-capture.js',
  'app.js',
  'v2-topic-picker.js',
  'avatar-selector.js',
  'interest-curve.js',
  'contact-carousel.js',
  'drift-wall.js',
  'README.md',
  'LICENSE',
  'NOTICE.md',
  'THIRD_PARTY_NOTICES.md'
];

const directories = ['assets', 'locales', 'vendor'];

const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(self)
/*.html
  Cache-Control: no-cache
`;

function stampProduction(html) {
  return html.replace(/<body\b([^>]*)>/i, (full, attrs) => {
    const cleaned = attrs.replace(/\sdata-environment\s*=\s*(['"]).*?\1/, '');
    return `<body data-environment="production"${cleaned}>`;
  });
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function packageWeb({ rootDir = defaultRoot, outDir } = {}) {
  const dest = outDir || path.join(rootDir, 'dist');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const file of pages) {
    const source = fs.readFileSync(path.join(rootDir, file), 'utf8');
    fs.writeFileSync(path.join(dest, file), stampProduction(source));
  }
  for (const file of rootFiles) copyFile(path.join(rootDir, file), path.join(dest, file));
  for (const dir of directories) fs.cpSync(path.join(rootDir, dir), path.join(dest, dir), { recursive: true });
  fs.writeFileSync(path.join(dest, '_headers'), headers);
  return dest;
}

if (require.main === module) {
  const dest = packageWeb();
  process.stdout.write(`Wrote static site to ${dest}\n`);
}

module.exports = { packageWeb, stampProduction, pages, rootFiles, directories };
