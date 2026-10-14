/** Validate server-side separation before any backend call. */
export function validateNamespaces({ demo, privateNotes, sandbox }) {
  const names = [demo, privateNotes, sandbox];
  if (names.some(n => typeof n !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(n))) {
    throw new Error('Three explicit valid namespace names are required');
  }
  if (new Set(names).size !== names.length) {
    throw new Error('Demo, private and sandbox namespaces must differ');
  }
  return Object.freeze({ demo, privateNotes, sandbox });
}
