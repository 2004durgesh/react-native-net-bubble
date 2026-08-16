import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NetworkRecord } from '../types';
import { RequestRow } from './RequestRow';
import { colors } from './theme';

type Props = {
  records: NetworkRecord[];
  onSelect: (id: string) => void;
};

export function RequestList({ records, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const data = useMemo(() => {
    const newestFirst = [...records].reverse();
    const q = query.trim().toLowerCase();
    if (!q) {
      return newestFirst;
    }
    return newestFirst.filter((record) => {
      if (record.url.toLowerCase().includes(q)) {
        return true;
      }
      if (record.method.toLowerCase().includes(q)) {
        return true;
      }
      if (record.origin && record.origin.file.toLowerCase().includes(q)) {
        return true;
      }
      return String(record.status ?? '').includes(q);
    });
  }, [records, query]);

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Filter by URL, method, file, status…"
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {records.length === 0
              ? 'No requests captured yet.\nFire a network request to see it here.'
              : 'No requests match your filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestRow record={item} onPress={onSelect} />
          )}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          removeClippedSubviews
        />
      )}
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
