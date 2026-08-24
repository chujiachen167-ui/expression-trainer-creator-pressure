const assert = require('node:assert/strict');

global.window = {};
global.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) || null; },
  setItem(key, value) { this.values.set(key, value); }
};

require('../audience-templates.js');
require('../avatar-provider.js');

const engine = window.CreatorAudienceEngine;
const avatar = window.CreatorAvatarProvider;

assert.ok(engine, 'Audience engine should be exported');
assert.ok(avatar, 'Avatar provider factory should be exported');
assert.ok(engine.templates.length >= 8, 'First release should include at least eight audience templates');

const techTemplate = engine.getTemplate('tech-comparison');
assert.equal(techTemplate.domain, '科技数码');
assert.deepEqual(engine.getProfiles(techTemplate).map(item => item.id), ['comparisonBuyer', 'practicalBuyer', 'skeptic']);

const vagueObservation = engine.observe('这个产品有很多比较好的方面', 14);
assert.equal(vagueObservation.specificity, true);
assert.deepEqual(vagueObservation.vague, ['很多', '比较', '方面']);

const openingObservation = engine.observe('', 12);
const reaction = engine.nextReaction({
  template: techTemplate,
  profile: engine.getProfiles(techTemplate)[0],
  observation: openingObservation,
  pressure: 'medium',
  eventIndex: 0
});
assert.equal(reaction.signal, 'opening');
assert.match(reaction.text, /结论/);
assert.match(reaction.text, /帮助观众做购买判断/);

const quietReaction = engine.nextReaction({
  template: techTemplate,
  profile: engine.getProfiles(techTemplate)[0],
  observation: engine.observe('', 0),
  pressure: 'medium',
  eventIndex: 7
});
assert.equal(quietReaction.signal, 'continue');
assert.doesNotMatch(quietReaction.text, /undefined/);

const provider = avatar.create({ provider: 'mock' });
assert.ok(provider, 'Mock provider should be constructible without a backend');
assert.equal(avatar.loadConfig().provider, 'mock');

console.log('Audience engine contract tests passed.');
