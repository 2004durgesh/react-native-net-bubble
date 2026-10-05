import { describe, expect, it } from '@jest/globals';
import { configureSymbolication, symbolicate } from '../core/symbolication';

// Shape of a real Hermes release stack captured by jsCapture on iOS.
const BUNDLE =
  'file:///private/var/containers/Bundle/Application/X/NetBubbleExample.app/main.jsbundle';
const STACK = [
  'Error: [NetBubble] request origin',
  `    at captureStack (address at ${BUNDLE}:1:100)`,
  `    at patchedOpen (address at ${BUNDLE}:1:200)`,
  `    at anonymous (address at ${BUNDLE}:1:300)`,
  '    at tryCallTwo (address at InternalBytecode.js:1:400)',
  '    at Promise (address at InternalBytecode.js:1:1418)',
  `    at fetch (address at ${BUNDLE}:1:500)`,
  `    at ?anon_0_ (address at ${BUNDLE}:1:600)`,
  '    at next (native)',
].join('\n');

const FILES_BY_OFFSET: Record<number, string> = {
  100: 'src/core/jsCapture.ts',
  200: 'src/core/jsCapture.ts',
  300: 'node_modules/whatwg-fetch/dist/fetch.umd.js',
  // Hermes-internal offset that happens to collide with an app offset.
  400: 'src/screens/Wrong.tsx',
  500: 'node_modules/whatwg-fetch/dist/fetch.umd.js',
  600: 'src/screens/Profile.tsx',
};

describe('symbolicate with a resolver', () => {
  it('returns the first frame that resolves to app code', async () => {
    const resolved: number[] = [];
    configureSymbolication({
      resolveFrame: (frame) => {
        resolved.push(frame.column ?? -1);
        const file = FILES_BY_OFFSET[frame.column ?? -1];
        return file ? { file, line: 1, column: 0, raw: frame.raw } : undefined;
      },
    });

    const origin = await symbolicate(STACK);

    expect(origin?.file).toBe('src/screens/Profile.tsx');
    expect(resolved).toEqual([100, 200, 300, 500, 600]);
  });

  it('skips frames whose resolver throws', async () => {
    configureSymbolication({
      resolveFrame: (frame) => {
        if (frame.column !== 600) {
          throw new Error('lookup failed');
        }
        return { file: 'src/screens/Profile.tsx', line: 1, raw: frame.raw };
      },
    });

    expect((await symbolicate(STACK))?.file).toBe('src/screens/Profile.tsx');
  });
});
