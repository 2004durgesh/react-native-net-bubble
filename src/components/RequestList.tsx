import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NetworkRecord } from '../types';
import { CopyMenu } from './CopyMenu';
import { RequestRow } from './RequestRow';
import { colors } from './theme';

// ─── types ───────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | '2xx' | '3xx' | '4xx' | '5xx' | 'err';

type Props = {
  records: NetworkRecord[];
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
};

// ─── constants ───────────────────────────────────────────────────────────────

const CHIPS: { id: StatusFilter; label: string; activeColor: string }[] = [
  { id: 'all', label: 'All', activeColor: colors.accent },
  { id: '2xx', label: '2xx', activeColor: colors.green },
  { id: '3xx', label: '3xx', activeColor: colors.yellow },
  { id: '4xx', label: '4xx', activeColor: colors.red },
  { id: '5xx', label: '5xx', activeColor: colors.red },
  { id: 'err', label: 'ERR', activeColor: colors.red },
];

function matchesStatus(record: NetworkRecord, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'err')
    return record.state === 'error' && record.status == null;
  const s = record.status;
  if (s == null) return false;
  if (filter === '2xx') return s >= 200 && s < 300;
  if (filter === '3xx') return s >= 300 && s < 400;
  if (filter === '4xx') return s >= 400 && s < 500;
  if (filter === '5xx') return s >= 500;
  return false;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

const TOAST_DURATION = 1800;

function Toast({ message }: { message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(TOAST_DURATION - 300),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── RequestList ─────────────────────────────────────────────────────────────

export function RequestList({
  records,
  onSelect,
  query,
  onQueryChange,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [copyTargetId, setCopyTargetId] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  const data = useMemo(() => {
    const newestFirst = [...records].reverse();
    const q = query.trim().toLowerCase();
    return newestFirst.filter((record) => {
      // Status chip filter
      if (!matchesStatus(record, statusFilter)) return false;
      // Text query filter
      if (!q) return true;
      if (record.url.toLowerCase().includes(q)) return true;
      if (record.method.toLowerCase().includes(q)) return true;
      if (record.origin && record.origin.file.toLowerCase().includes(q))
        return true;
      return String(record.status ?? '').includes(q);
    });
  }, [records, query, statusFilter]);

  const copyTarget =
    copyTargetId != null
      ? (records.find((r) => r.id === copyTargetId) ?? null)
      : null;

  const handleLongPress = useCallback((id: string) => {
    setCopyTargetId(id);
  }, []);

  function handleCopied(label: string) {
    setToastMessage(`✓ ${label}`);
    setToastKey((k) => k + 1);
  }

  function clearFilters() {
    onQueryChange('');
    setStatusFilter('all');
  }

  const isFiltered = query.trim() !== '' || statusFilter !== 'all';

  return (
    <View style={styles.container}>
      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Filter by URL, method, file, status…"
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* ── Status chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
        contentContainerStyle={styles.chipBarInner}
      >
        {CHIPS.map(({ id, label, activeColor }) => {
          const active = statusFilter === id;
          return (
            <Pressable
              key={id}
              onPress={() => setStatusFilter(id)}
              style={[
                styles.chip,
                active && {
                  backgroundColor: activeColor,
                  borderColor: activeColor,
                },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── List / empty state ── */}
      {data.length === 0 ? (
        <View style={styles.empty}>
          {records.length === 0 ? (
            <Text style={styles.emptyText}>
              No requests captured yet.{'\n'}Fire a network request to see it
              here.
            </Text>
          ) : (
            <>
              <Text style={styles.emptyText}>
                No requests match your filter.
              </Text>
              {isFiltered ? (
                <Pressable onPress={clearFilters} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear filters</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestRow
              record={item}
              onPress={onSelect}
              onLongPress={handleLongPress}
            />
          )}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          removeClippedSubviews
        />
      )}

      {/* ── Copy menu (shown on long-press) ── */}
      {copyTarget != null ? (
        <CopyMenu
          record={copyTarget}
          onClose={() => setCopyTargetId(null)}
          onCopied={handleCopied}
        />
      ) : null}

      {/* ── "Copied!" toast ── */}
      {toastMessage ? <Toast key={toastKey} message={toastMessage} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  search: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
  },

  // Status chips
  chipBar: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chipBarInner: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: {
    color: colors.subtext,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  clearBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  toastText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
