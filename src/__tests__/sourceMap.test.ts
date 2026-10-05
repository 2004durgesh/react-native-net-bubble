import { describe, expect, it } from '@jest/globals';
import { createSourceMapLookup } from '../core/sourceMap';

// Expected values cross-checked against source-map-js's originalPositionFor.
const lookup = createSourceMapLookup(
  JSON.stringify({
    version: 3,
    sources: ['a.js', 'b.js'],
    names: ['foo'],
    // Covers names, negative deltas, a source-less segment and a multi-digit VLQ.
    mappings: 'AAAA,KAAKA;ACCA,EDDC,C;gBAAA',
  })
);

describe('createSourceMapLookup', () => {
  it('resolves exact and greatest-lower-bound columns', () => {
    expect(lookup(1, 0)).toEqual({
      source: 'a.js',
      line: 1,
      column: 0,
      name: undefined,
    });
    expect(lookup(1, 3)).toEqual({
      source: 'a.js',
      line: 1,
      column: 0,
      name: undefined,
    });
    expect(lookup(1, 5)).toEqual({
      source: 'a.js',
      line: 1,
      column: 5,
      name: 'foo',
    });
    expect(lookup(1, 99)).toEqual({
      source: 'a.js',
      line: 1,
      column: 5,
      name: 'foo',
    });
  });

  it('carries source/line/column state across lines', () => {
    expect(lookup(2, 1)).toEqual({
      source: 'b.js',
      line: 2,
      column: 5,
      name: undefined,
    });
    expect(lookup(2, 2)).toEqual({
      source: 'a.js',
      line: 1,
      column: 6,
      name: undefined,
    });
    expect(lookup(3, 16)).toEqual({
      source: 'a.js',
      line: 1,
      column: 6,
      name: undefined,
    });
  });

  it('returns undefined for unmapped positions', () => {
    expect(lookup(2, 3)).toBeUndefined();
    expect(lookup(2, 10)).toBeUndefined();
    expect(lookup(3, 15)).toBeUndefined();
    expect(lookup(4, 0)).toBeUndefined();
  });

  it('picks the first of several segments at the same column', () => {
    const dup = createSourceMapLookup(
      JSON.stringify({
        version: 3,
        sources: ['a.js'],
        names: [],
        mappings: 'AAAA,AACA',
      })
    );
    expect(dup(1, 0)).toEqual({
      source: 'a.js',
      line: 1,
      column: 0,
      name: undefined,
    });
  });
});
