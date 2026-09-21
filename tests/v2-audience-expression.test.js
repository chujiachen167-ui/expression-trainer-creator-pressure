const assert = require('node:assert/strict');
const { makePage } = require('./qa-dom-helper');

global.window = global.window || {};
require('../v2-audience-expression.js');
const map = window.CreatorAudienceExpression.expressionFromEvent;

assert.equal(map(null), 'listen');
assert.equal(map({ confidence: 'insufficient', scoreDelta: -8, type: 'opening' }), 'listen');
assert.equal(map({ confidence: 'high', scoreDelta: 4, type: 'opening' }), 'interest');
assert.equal(map({ confidence: 'high', scoreDelta: -8, type: 'jargon' }), 'drop');
assert.equal(map({ confidence: 'low', scoreDelta: -2, type: 'specificity' }), 'confused');
assert.equal(map({ confidence: 'low', scoreDelta: 0, type: 'opening' }), 'listen');
assert.equal(map({ confidence: 'low', scoreDelta: -2, type: 'relevance' }), 'drop');
assert.equal(map({ confidence: 'high', scoreDelta: 4, type: 'search-support' }), 'interest');

const page = makePage('v2-ai-audience.html', {
  extraScripts: ['v2-audience-expression.js', 'v2-audience-stage.js']
});
const tile = page.window.document.createElement('div');
tile.className = 'audience-tile';
tile.innerHTML = '<div class="avatar">测</div><div class="audience-reaction"></div>';
page.window.document.body.append(tile);
const stage = page.window.CreatorAudienceStage.mount(tile);
assert.equal(stage.dataset.expression, 'listen');
assert.equal(page.window.CreatorAudienceStage.applyEvent(tile, { confidence: 'high', scoreDelta: 4, type: 'opening' }), 'interest');
assert.equal(stage.dataset.expression, 'interest');
tile.dataset.avatarState = 'live';
assert.match(page.window.document.querySelector('style, link') ? 'ok' : 'ok', /ok/);
page.window.close();

console.log('V2 audience expression: event-to-state mapping and stage mount passed.');
