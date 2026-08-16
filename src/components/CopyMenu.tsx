import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { copyToClipboard } from '../core/clipboard';
import { buildCurl, buildCurlCmd, buildFetch } from '../core/copyAs';
import type { NetworkRecord } from '../types';
import { colors, methodColor, splitUrl } from './theme';

type Props = {
  record: NetworkRecord;
  onClose: () => void;
  /** Called with a label when text was copied directly to clipboard. */
  onCopied: (label: string) => void;
};

type CopyOption = {
  label: string;
  build: () => string;
};

function buildOptions(record: NetworkRecord): CopyOption[] {
  const opts: CopyOption[] = [
    { label: 'Copy URL', build: () => record.url },
    { label: 'Copy as cURL', build: () => buildCurl(record) },
    { label: 'Copy as cURL (cmd)', build: () => buildCurlCmd(record) },
    { label: 'Copy as fetch', build: () => buildFetch(record) },
  ];
  if (record.responseBody) {
    opts.push({
      label: 'Copy Response Body',
      build: () => record.responseBody as string,
    });
  }
  return opts;
}

export function CopyMenu({ record, onClose, onCopied }: Props) {
  const { host, path } = splitUrl(record.url);
  const options = buildOptions(record);

  async function handleOption(opt: CopyOption) {
    onClose();
    const direct = await copyToClipboard(opt.build());
    if (direct) {
      onCopied(opt.label);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Tap backdrop to dismiss */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so tapping the sheet itself doesn't close */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* ── Request summary ── */}
          <View style={styles.header}>
            <Text
              style={[
                styles.headerMethod,
                { color: methodColor(record.method) },
              ]}
            >
              {record.method.toUpperCase()}
            </Text>
            <View style={styles.headerMeta}>
              <Text style={styles.headerPath} numberOfLines={1}>
                {path}
              </Text>
              <Text style={styles.headerHost} numberOfLines={1}>
                {host}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closeBtnPressed,
              ]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* ── Copy options ── */}
          {options.map((opt, i) => (
            <Pressable
              key={opt.label}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
                i < options.length - 1 && styles.optionBorder,
              ]}
              onPress={() => handleOption(opt)}
            >
              <Text style={styles.optionText}>{opt.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingBottom: 32,
    overflow: 'hidden',
  },

  // Request summary header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  headerMethod: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  headerMeta: {
    flex: 1,
    gap: 2,
  },
  headerPath: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  headerHost: {
    color: colors.subtext,
    fontSize: 11,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },

  // Options
  option: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.panel,
  },
  optionPressed: {
    backgroundColor: colors.card,
  },
  optionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },

  // Close button in header
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeBtnPressed: {
    backgroundColor: colors.border,
  },
  closeBtnText: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 16,
  },
});
