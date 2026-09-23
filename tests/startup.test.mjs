import test from 'node:test';
import assert from 'node:assert/strict';
import { returningUserRoute, startupView } from '../src/startup.js';

test('remembered users bypass the entry and sign-in pages but retain deep links', () => {
  const user = { authed: true, onboarded: true };
  for (const hash of ['', '#/', '#/login', '#/signup', '#/login?next=dashboard'])
    assert.equal(returningUserRoute(user, hash), '#/app/dashboard');
  assert.equal(returningUserRoute(user, '#/app/inventory'), null);
  assert.equal(returningUserRoute({ authed: true, onboarded: false }, '#/'), '#/onboarding');
  assert.equal(returningUserRoute({ authed: false }, '#/login'), null);
});

test('startup uses neutral placeholders without an opening-workspace interstitial or private data', () => {
  assert.match(startupView(), /aria-busy="true"/);
  assert.doesNotMatch(startupView(), /Opening|Connecting|auth-wrap|GreenFork|Sign In/);
});
