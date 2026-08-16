import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NetworkRecord } from '../types';
import {
  colors,
  formatDuration,
  methodColor,
  splitUrl,
  statusColor,
} from './theme';

type Props = {
  record: NetworkRecord;
  onPress: (id: string) => void;
};

function RequestRowComponent({ record, onPress }: Props) {
  const { host, path } = splitUrl(record.url);
  const statusLabel =
    record.state === 'pending'
      ? '···'
      : record.state === 'error' && record.status == null
        ? 'ERR'
        : String(record.status ?? '');

  const origin = record.origin;
  const originLabel = origin
    ? `${origin.file}${origin.line != null ? `:${origin.line}` : ''}`
    : undefined;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(record.id)}
    >
      <View style={styles.topLine}>
        <Text style={[styles.method, { color: methodColor(record.method) }]}>
          {record.method.toUpperCase()}
        </Text>
        <Text style={styles.path} numberOfLines={1} ellipsizeMode="middle">
          {path}
        </Text>
        <Text
          style={[
            styles.status,
            { color: statusColor(record.status, record.state) },
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      <View style={styles.bottomLine}>
        <Text style={styles.host} numberOfLines={1}>
          {host}
        </Text>
        <Text style={styles.duration}>{formatDuration(record.duration)}</Text>
      </View>
      {originLabel ? (
        <Text style={styles.origin} numberOfLines={1} ellipsizeMode="middle">
          ⟶ {originLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const RequestRow = memo(RequestRowComponent);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.cardAlt,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  method: {
    fontSize: 12,
    fontWeight: '800',
    width: 58,
  },
  path: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    marginHorizontal: 8,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 34,
    textAlign: 'right',
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  host: {
    flex: 1,
    color: colors.subtext,
    fontSize: 11,
    marginRight: 8,
  },
  duration: {
    color: colors.faint,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  origin: {
    color: colors.accent,
    fontSize: 11,
    marginTop: 3,
  },
});
