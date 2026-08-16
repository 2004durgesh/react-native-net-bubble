import { useEffect, useState } from 'react';
import { isInspectorEnabled } from '../core/gating';
import type { GatingOptions } from '../core/gating';
import { installJsCapture, uninstallJsCapture } from '../core/jsCapture';
import { useNetworkRequests } from '../hooks/useNetworkRequests';
import { requireNativeModule } from '../nativeModule';
import { networkStore } from '../store/NetworkStore';
import { FloatingBubble } from './FloatingBubble';
import { InspectorPanel } from './InspectorPanel';

export type NetBubbleProps = GatingOptions & {
  /** Max body bytes captured per request (default 1 MiB). */
  maxBodyBytes?: number;
  /** Max number of records kept in memory (default 500). */
  maxRecords?: number;
  /** Override the bubble's background color. */
  bubbleColor?: string;
};

/**
 * Drop-in network inspector. Mount it once near the root of your app:
 *
 * ```tsx
 * <NetBubble enabled={getApiBaseUrl() !== PROD_BASE_URL} />
 * ```
 *
 * When gating resolves to `false` it renders nothing and never starts native
 * interception — so in production it is effectively absent.
 */
export function NetBubble(props: NetBubbleProps) {
  const {
    enabled,
    baseUrl,
    prodBaseUrl,
    maxBodyBytes,
    maxRecords,
    bubbleColor,
  } = props;
  const active = isInspectorEnabled({ enabled, baseUrl, prodBaseUrl });
  const [open, setOpen] = useState(false);
  const records = useNetworkRequests();

  useEffect(() => {
    if (!active) {
      return;
    }

    if (maxRecords != null) {
      networkStore.setMaxRecords(maxRecords);
    }
    installJsCapture();

    const native = requireNativeModule();
    let subscription: { remove: () => void } | undefined;
    if (native) {
      if (maxBodyBytes != null) {
        try {
          native.setMaxBodyBytes(maxBodyBytes);
        } catch {
          // ignore
        }
      }
      subscription = native.onNetworkEvent((payload) => {
        networkStore.ingest(payload);
      });
      try {
        native.start();
      } catch {
        // ignore
      }
    }

    return () => {
      if (native) {
        try {
          native.stop();
        } catch {
          // ignore
        }
      }
      subscription?.remove();
      uninstallJsCapture();
    };
  }, [active, maxBodyBytes, maxRecords]);

  if (!active) {
    return null;
  }

  const hasError = records.some(
    (r) => r.state === 'error' || (r.status != null && r.status >= 400)
  );

  return (
    <>
      <FloatingBubble
        count={records.length}
        color={bubbleColor}
        hasError={hasError}
        onPress={() => setOpen(true)}
      />
      <InspectorPanel visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
