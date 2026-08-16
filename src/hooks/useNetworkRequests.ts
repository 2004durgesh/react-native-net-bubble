import { useSyncExternalStore } from 'react';
import { networkStore } from '../store/NetworkStore';
import type { NetworkRecord } from '../types';

/**
 * Subscribe a component to the live network record list. Returns records in
 * insertion order (oldest first); the inspector UI renders them newest-first.
 */
export function useNetworkRequests(): NetworkRecord[] {
  return useSyncExternalStore(
    networkStore.subscribe,
    networkStore.getSnapshot,
    networkStore.getSnapshot
  );
}
