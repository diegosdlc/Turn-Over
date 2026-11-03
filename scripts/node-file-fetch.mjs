// Node-only preload: emulate browser fetch for local assets used by balance data.
import { readFile } from 'node:fs/promises';

const originalFetch = globalThis.fetch;
globalThis.fetch = async function fetchWithLocalFiles(input, init) {
  const url = input instanceof URL ? input : new URL(input.url ?? input, 'file:///');
  if (url.protocol === 'file:') {
    const content = await readFile(url);
    return new Response(content, { status: 200 });
  }
  return originalFetch(input, init);
};
