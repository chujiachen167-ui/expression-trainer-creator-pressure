const assert = require('node:assert/strict');
const { makePage, input } = require('./qa-dom-helper');

const dom = makePage('index.html');
const { window } = dom;
const { document } = window;
const header = document.querySelector('[data-product-shell="header"]');
const footer = document.querySelector('.product-footer');
const trigger = document.querySelector('[data-account-trigger]');
const accountPanel = document.querySelector('[data-account-panel]');

assert(header && footer && trigger && accountPanel, 'launcher renders the full product shell');
assert.equal(header.hidden, false);
assert.equal(footer.hidden, false);
assert.equal(accountPanel.hidden, true);
trigger.click();
assert.equal(accountPanel.hidden, false, 'account trigger opens the local profile panel');
assert.equal(trigger.getAttribute('aria-expanded'), 'true');
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
assert.equal(accountPanel.hidden, true, 'Escape closes the account panel');

trigger.click();
accountPanel.querySelector('[data-open-product-settings="palette"]').click();
assert.equal(document.querySelector('.qa-panel').hidden, false, 'appearance entry opens the existing control panel');
assert.equal(document.querySelector('[data-qa-tab="palette"]').getAttribute('aria-selected'), 'true');

input(window, 'components.productShell.footerBackground', '#18151d');
assert.equal(document.documentElement.style.getPropertyValue('--product-footer-bg'), '#18151d');
input(window, 'components.productShell.headerEnabled', false);
assert.equal(header.hidden, true, 'header switch removes the product navigation');
input(window, 'components.productShell.headerEnabled', true);
input(window, 'components.productShell.footerEnabled', false);
assert.equal(footer.hidden, true, 'footer switch removes both footer surfaces');
assert.equal(document.querySelector('.product-assurance').hidden, true);

document.querySelector('[data-qa-tab="copy"]').click();
assert(document.querySelector('[data-copy-key="launcher.shell.footer.title"]'), 'new shell copy is editable in the copy panel');
assert.equal([...footer.querySelectorAll('a')].some(link => link.getAttribute('href') === '#'), false, 'footer contains no placeholder destinations');
assert.equal(dom.qaErrors.length, 0);
window.close();
console.log('Product shell: honest local account, settings handoff, configurable footer and editable copy passed (DOM).');
