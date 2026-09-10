#!/usr/bin/env node
/** Build a browser-only static tree for Cloudflare Pages (scheme C).
 *  Dashboard: build command `node scripts/package-web.js`, output `dist`,
 *  env SKIP_DEPENDENCY_INSTALL=1 so Pages does not npm-install Electron/Sherpa.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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
  'home-fusion.css',
  'home-fusion.js',
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
  'web-stt.js',
  'stt-audio.js',
  'media-capture.js',
  'app.js',
  'v2-topic-picker.js',
  'v2-session-model.js',
  'v2-rule-judge.js',
  'v2-review.js',
  'v2-interest-panel.js',
  'v2-focus.js',
  'v2-focus.css',
  'avatar-selector.js',
  'interest-curve.js',
  'contact-carousel.js',
  'drift-wall.js',
  'README.md',
  'LICENSE',
  'NOTICE.md',
  'THIRD_PARTY_NOTICES.md',
  'BingSiteAuth.xml'
];

const directories = ['assets', 'locales', 'vendor'];

const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(self)
  Cache-Control: public, max-age=0, must-revalidate
/*.html
  Cache-Control: no-cache
`;

function stampProduction(html, assetVersion = '') {
  const stamped = html.replace(/<body\b([^>]*)>/i, (full, attrs) => {
    const cleaned = attrs.replace(/\sdata-environment\s*=\s*(['"]).*?\1/, '');
    return `<body data-environment="production"${cleaned}>`;
  });
  if (!assetVersion) return stamped;
  return stamped.replace(/\b(src|href)=(['"])(?!https?:|\/\/|data:)([^'"?#]+\.(?:js|css))(?:\?[^'"]*)?\2/gi,
    (full, attribute, quote, asset) => `${attribute}=${quote}${asset}?v=${assetVersion}${quote}`);
}

function deploymentVersion(rootDir) {
  const commit = String(process.env.CF_PAGES_COMMIT_SHA || '').match(/^[a-f0-9]{7,64}$/i)?.[0];
  if (commit) return commit.slice(0, 12).toLowerCase();
  const hash = crypto.createHash('sha256');
  const visit = relativePath => {
    const absolutePath = path.join(rootDir, relativePath);
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      fs.readdirSync(absolutePath).sort().forEach(name => visit(path.join(relativePath, name)));
      return;
    }
    hash.update(relativePath.replaceAll('\\', '/'));
    hash.update(fs.readFileSync(absolutePath));
  };
  [...new Set([...pages, ...rootFiles, ...directories])].sort().forEach(visit);
  return hash.digest('hex').slice(0, 12);
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function packageWeb({ rootDir = defaultRoot, outDir } = {}) {
  const dest = outDir || path.join(rootDir, 'dist');
  const assetVersion = deploymentVersion(rootDir);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const file of pages) {
    const source = fs.readFileSync(path.join(rootDir, file), 'utf8');
    fs.writeFileSync(path.join(dest, file), stampProduction(source, assetVersion));
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

module.exports = { packageWeb, stampProduction, deploymentVersion, pages, rootFiles, directories };
