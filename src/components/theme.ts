import type { NetworkRequestState } from '../types';

export const colors = {
  scrim: 'rgba(0,0,0,0.55)',
  bg: '#0b0f14',
  panel: '#0f1620',
  card: '#161f2b',
  cardAlt: '#131b26',
  border: '#243244',
  text: '#e6edf3',
  subtext: '#8b98a5',
  faint: '#5b6773',
  accent: '#4c8dff',
  onAccent: '#ffffff',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  purple: '#a371f7',
  pink: '#db61a2',
} as const;

export function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return colors.green;
    case 'POST':
      return colors.yellow;
    case 'PUT':
      return colors.purple;
    case 'PATCH':
      return colors.pink;
    case 'DELETE':
      return colors.red;
    default:
      return colors.subtext;
  }
}

export function statusColor(
  status: number | undefined,
  state: NetworkRequestState
): string {
  if (state === 'pending') {
    return colors.subtext;
  }
  if (state === 'error') {
    return colors.red;
  }
  if (status == null) {
    return colors.subtext;
  }
  if (status >= 400) {
    return colors.red;
  }
  if (status >= 300) {
    return colors.yellow;
  }
  if (status >= 200) {
    return colors.green;
  }
  return colors.subtext;
}

export function splitUrl(url: string): { host: string; path: string } {
  const match = /^[a-z]+:\/\/([^/]+)(\/[^?#]*)?/i.exec(url);
  if (!match) {
    return { host: '', path: url };
  }
  return { host: match[1] ?? '', path: match[2] ?? '/' };
}

export function formatDuration(ms: number | undefined): string {
  if (ms == null) {
    return '';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}
