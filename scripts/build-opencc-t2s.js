#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'third_party', 'opencc-1.3.1');
const outputFile = path.join(root, 'functions', 'lib', 'opencc-t2s.js');

function readDictionary(filename) {
  return fs.readFileSync(path.join(sourceDir, filename), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [source, rawTargets = ''] = line.split(/\t+/);
      return [source, rawTargets.split(/\s+/)[0] || source];
    });
}

const phrases = readDictionary('TSPhrases.txt')
  .filter(([source, target]) => source && target && source !== target)
  .sort((left, right) => right[0].length - left[0].length || left[0].localeCompare(right[0], 'zh-CN'));
const characters = readDictionary('TSCharacters.txt')
  .filter(([source, target]) => source.length === 1 && target && source !== target)
  .sort((left, right) => left[0].localeCompare(right[0], 'zh-CN'));

const source = `/**
 * Generated from OpenCC 1.3.1 TSCharacters.txt and TSPhrases.txt.
 * Source: https://github.com/BYVoid/OpenCC/tree/ver.1.3.1/data/dictionary
 * License: Apache-2.0; retained at third_party/opencc-1.3.1/LICENSE.
 */
const phraseEntries = ${JSON.stringify(phrases)};
const characterEntries = ${JSON.stringify(characters)};
const phraseMap = new Map(phraseEntries);
const characterMap = new Map(characterEntries);
const maxPhraseLength = phraseEntries.reduce((maximum, [phrase]) => Math.max(maximum, phrase.length), 1);

export function toSimplifiedChinese(input) {
  const text = String(input || '');
  let output = '';
  let index = 0;
  while (index < text.length) {
    let replacement = '';
    let consumed = 0;
    for (let length = Math.min(maxPhraseLength, text.length - index); length > 1; length -= 1) {
      const phrase = text.slice(index, index + length);
      const mapped = phraseMap.get(phrase);
      if (!mapped) continue;
      replacement = mapped;
      consumed = length;
      break;
    }
    if (consumed) {
      output += replacement;
      index += consumed;
      continue;
    }
    const character = text[index];
    output += characterMap.get(character) || character;
    index += 1;
  }
  return output;
}
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, source, 'utf8');
process.stdout.write(`Wrote ${outputFile} with ${phrases.length} phrases and ${characters.length} characters.\n`);
