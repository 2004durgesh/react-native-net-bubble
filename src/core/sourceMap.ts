/* eslint-disable no-bitwise -- base64 VLQ decoding */

export type OriginalPosition = {
  source: string;
  /** 1-based. */
  line: number;
  /** 0-based. */
  column: number;
  name?: string;
};

type RawSourceMap = {
  sources: string[];
  names?: string[];
  mappings: string;
};

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE64.length; i++) {
  BASE64_VALUES[BASE64.charCodeAt(i)] = i;
}
const COMMA = 44;
const SEMICOLON = 59;

// Each decoded segment occupies 5 slots: genColumn, source, line, column, name.
// source/name are -1 when the segment omits them.
const SEGMENT_SIZE = 5;

function decodeMappings(mappings: string): Int32Array[] {
  const lines: Int32Array[] = [];
  const fields = [0, 0, 0, 0, 0];
  let current: number[] = [];
  let genColumn = 0;
  let source = 0;
  let line = 0;
  let column = 0;
  let name = 0;
  let i = 0;

  while (i <= mappings.length) {
    const ch = i < mappings.length ? mappings.charCodeAt(i) : SEMICOLON;
    if (ch === SEMICOLON) {
      lines.push(Int32Array.from(current));
      current = [];
      genColumn = 0;
      i++;
      continue;
    }
    if (ch === COMMA) {
      i++;
      continue;
    }

    let count = 0;
    while (i < mappings.length) {
      const c = mappings.charCodeAt(i);
      if (c === COMMA || c === SEMICOLON) {
        break;
      }
      let value = 0;
      let shift = 0;
      let digit: number;
      do {
        digit = BASE64_VALUES[mappings.charCodeAt(i++)] ?? 0;
        value |= (digit & 31) << shift;
        shift += 5;
      } while (digit & 32);
      fields[count++] = value & 1 ? -(value >>> 1) : value >>> 1;
    }

    genColumn += fields[0]!;
    if (count < 4) {
      current.push(genColumn, -1, 0, 0, -1);
      continue;
    }
    source += fields[1]!;
    line += fields[2]!;
    column += fields[3]!;
    if (count >= 5) {
      name += fields[4]!;
    }
    current.push(genColumn, source, line, column, count >= 5 ? name : -1);
  }
  return lines;
}

// Not source-map-js: it rebuilds its sort via Function.prototype.toString(), which is `[bytecode]` under Hermes release builds.
export function createSourceMapLookup(
  mapJson: string
): (line: number, column: number) => OriginalPosition | undefined {
  const map = JSON.parse(mapJson) as RawSourceMap;
  let lines: Int32Array[] | undefined;

  return (line, column) => {
    lines ??= decodeMappings(map.mappings);
    const segments = lines[line - 1];
    if (!segments || segments.length === 0) {
      return undefined;
    }

    let lo = 0;
    let hi = segments.length / SEGMENT_SIZE - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid * SEGMENT_SIZE]! <= column) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (found < 0) {
      return undefined;
    }
    const genColumn = segments[found * SEGMENT_SIZE]!;
    while (found > 0 && segments[(found - 1) * SEGMENT_SIZE] === genColumn) {
      found--;
    }

    const base = found * SEGMENT_SIZE;
    const sourceIndex = segments[base + 1]!;
    const source = sourceIndex >= 0 ? map.sources[sourceIndex] : undefined;
    if (source == null) {
      return undefined;
    }
    const nameIndex = segments[base + 4]!;
    return {
      source,
      line: segments[base + 2]! + 1,
      column: segments[base + 3]!,
      name: nameIndex >= 0 ? map.names?.[nameIndex] : undefined,
    };
  };
}
