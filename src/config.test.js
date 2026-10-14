import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNamespaces } from './config.js';
test('private data cannot share the public demo namespace', () => {
  assert.throws(() => validateNamespaces({demo:'public',privateNotes:'public',sandbox:'test'}));
  assert.throws(() => validateNamespaces({demo:'public',privateNotes:'owner'}));
  assert.deepEqual(validateNamespaces({demo:'public',privateNotes:'owner',sandbox:'test'}),
    {demo:'public',privateNotes:'owner',sandbox:'test'});
});
