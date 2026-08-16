import { Share } from 'react-native';

/**
 * Copy `text` to the clipboard.
 *
 * Tries `@react-native-clipboard/clipboard` first (many host apps ship it).
 * Falls back to the system Share sheet when the package isn't present — the
 * native sheet always includes a "Copy" action on both iOS and Android.
 *
 * Returns `true` when the text landed directly on the clipboard, `false` when
 * the Share sheet was opened instead (so callers can skip showing a "Copied!"
 * toast in the latter case since the OS provides its own feedback).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const mod = require('@react-native-clipboard/clipboard') as {
      default?: { setString(s: string): void };
      setString?(s: string): void;
    };
    const setString = mod.default?.setString ?? mod.setString;
    if (typeof setString === 'function') {
      setString(text);
      return true;
    }
  } catch {
    // Package not available — fall through to Share
  }
  await Share.share({ message: text });
  return false;
}
