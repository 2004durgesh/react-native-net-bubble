import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNetworkRequests } from '../hooks/useNetworkRequests';
import { networkStore } from '../store/NetworkStore';
import { RequestDetail } from './RequestDetail';
import { RequestList } from './RequestList';
import { colors } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const TOP_INSET = Platform.select({
  ios: 44,
  android: (StatusBar.currentHeight ?? 0) + 8,
  default: 12,
});

export function InspectorPanel({ visible, onClose }: Props) {
  const records = useNetworkRequests();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    selectedId != null
      ? records.find((record) => record.id === selectedId)
      : undefined;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingTop: TOP_INSET }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {selected ? (
                <Pressable hitSlop={12} onPress={() => setSelectedId(null)}>
                  <Text style={styles.headerBtn}>‹ Back</Text>
                </Pressable>
              ) : (
                <Text style={styles.title}>Network</Text>
              )}
            </View>
            <View style={styles.headerRight}>
              {!selected ? (
                <>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{records.length}</Text>
                  </View>
                  <Pressable
                    hitSlop={12}
                    onPress={() => {
                      networkStore.clear();
                      setSelectedId(null);
                    }}
                  >
                    <Text style={styles.headerBtn}>Clear</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable hitSlop={12} onPress={onClose}>
                <Text style={[styles.headerBtn, styles.closeBtn]}>Close</Text>
              </Pressable>
            </View>
          </View>

          {selected ? (
            <RequestDetail record={selected} />
          ) : (
            <RequestList records={records} onSelect={setSelectedId} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.panel,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerBtn: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 16,
  },
  closeBtn: {
    fontWeight: '700',
  },
  countPill: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: colors.subtext,
    fontSize: 12,
    fontWeight: '700',
  },
});
