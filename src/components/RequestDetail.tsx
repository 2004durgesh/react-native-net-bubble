import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { copyToClipboard } from '../core/clipboard';
import type { NetworkRecord } from '../types';
import { colors, formatDuration, methodColor, statusColor } from './theme';

// ─── helpers ─────────────────────────────────────────────────────────────────

function prettyBody(
  body: string | undefined,
  contentType: string | undefined
): string {
  if (!body) {
    return '';
  }
  const isJson =
    (contentType?.includes('json') ?? false) || /^\s*[[{]/.test(body);
  if (isJson) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // not valid JSON, fall through to raw
    }
  }
  return body;
}

/** HH:MM:SS.mmm — more precise than toLocaleTimeString for timing views. */
function formatTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  badge,
  children,
  defaultExpanded = true,
}: {
  title: string;
  badge?: number;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [
          styles.sectionHeader,
          pressed && styles.sectionHeaderPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.sectionChevron}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge != null ? (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor } : null]}
        selectable
        numberOfLines={0}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── HeaderTable ─────────────────────────────────────────────────────────────

function HeaderTable({ headers }: { headers?: Record<string, string> }) {
  const entries = headers ? Object.entries(headers) : [];
  if (entries.length === 0) {
    return <Text style={styles.emptyInSection}>No headers</Text>;
  }
  return (
    <View>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.headerRow}>
          <Text style={styles.headerKey} selectable>
            {key}
          </Text>
          <Text style={styles.headerValue} selectable numberOfLines={0}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── CodeBlock ───────────────────────────────────────────────────────────────

function CodeBlock({ text, truncated }: { text: string; truncated?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const direct = await copyToClipboard(text);
    if (direct) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  if (!text) {
    return <Text style={styles.emptyInSection}>Empty</Text>;
  }

  return (
    <View style={styles.codeBlock}>
      {/* ── toolbar ── */}
      <View style={styles.codeToolbar}>
        {truncated ? (
          <Text style={styles.truncatedWarning}>
            ⚠ Truncated — increase maxBodyBytes
          </Text>
        ) : (
          <View />
        )}
        <Pressable
          onPress={handleCopy}
          hitSlop={8}
          style={({ pressed }) => [
            styles.copyBtn,
            pressed && styles.copyBtnPressed,
          ]}
        >
          <Text style={[styles.copyBtnText, copied && styles.copyBtnCopied]}>
            {copied ? '✓ Copied' : '⎘ Copy'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.code} selectable>
        {text}
      </Text>
    </View>
  );
}

// ─── tab definitions ─────────────────────────────────────────────────────────

type TabId = 'headers' | 'payload' | 'response' | 'timing' | 'initiator';

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'headers', label: 'Headers' },
  { id: 'payload', label: 'Payload' },
  { id: 'response', label: 'Response' },
  { id: 'timing', label: 'Timing' },
  { id: 'initiator', label: 'Initiator' },
];

// ─── tab panels ──────────────────────────────────────────────────────────────

function HeadersPanel({ record }: { record: NetworkRecord }) {
  const statusLabel =
    record.state === 'pending'
      ? 'Pending…'
      : `${record.status ?? ''} ${record.statusText ?? ''}`.trim() ||
        (record.state === 'error' ? 'Error' : '—');

  const reqHeaderCount = record.requestHeaders
    ? Object.keys(record.requestHeaders).length
    : 0;
  const resHeaderCount = record.responseHeaders
    ? Object.keys(record.responseHeaders).length
    : 0;

  return (
    <>
      <CollapsibleSection title="General">
        <InfoRow label="Request URL" value={record.url} />
        <InfoRow
          label="Request Method"
          value={record.method.toUpperCase()}
          valueColor={methodColor(record.method)}
        />
        <InfoRow
          label="Status Code"
          value={statusLabel}
          valueColor={statusColor(record.status, record.state)}
        />
        <InfoRow
          label="Duration"
          value={formatDuration(record.duration) || '—'}
        />
        <InfoRow
          label="Started"
          value={new Date(record.startTime).toLocaleTimeString()}
        />
        <InfoRow label="Platform" value={record.platform} />
        {record.contentType ? (
          <InfoRow label="Content-Type" value={record.contentType} />
        ) : null}
        {record.error ? (
          <InfoRow label="Error" value={record.error} valueColor={colors.red} />
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection title="Response Headers" badge={resHeaderCount}>
        <HeaderTable headers={record.responseHeaders} />
      </CollapsibleSection>

      <CollapsibleSection title="Request Headers" badge={reqHeaderCount}>
        <HeaderTable headers={record.requestHeaders} />
      </CollapsibleSection>
    </>
  );
}

function PayloadPanel({ record }: { record: NetworkRecord }) {
  if (!record.requestBody) {
    return <Text style={styles.emptyTabText}>No request payload.</Text>;
  }
  return (
    <CollapsibleSection title="Request Body">
      <View style={styles.codeWrapper}>
        <CodeBlock
          text={prettyBody(record.requestBody, record.contentType)}
          truncated={record.requestBodyTruncated}
        />
      </View>
    </CollapsibleSection>
  );
}

function ResponsePanel({ record }: { record: NetworkRecord }) {
  const contentType =
    record.responseHeaders?.['content-type'] ??
    record.responseHeaders?.['Content-Type'] ??
    record.contentType;

  if (!record.responseBody) {
    return <Text style={styles.emptyTabText}>No response body.</Text>;
  }
  return (
    <CollapsibleSection title="Response Body">
      <View style={styles.codeWrapper}>
        <CodeBlock
          text={prettyBody(record.responseBody, contentType)}
          truncated={record.responseBodyTruncated}
        />
      </View>
    </CollapsibleSection>
  );
}

function TimingPanel({ record }: { record: NetworkRecord }) {
  const isPending = record.state === 'pending';
  const sc = statusColor(record.status, record.state);

  return (
    <>
      <CollapsibleSection title="Timeline">
        <View style={styles.timingWrap}>
          {/* Timestamps above bar */}
          <View style={styles.timingAboveBar}>
            <Text style={styles.timingTs}>
              {formatTimestamp(record.startTime)}
            </Text>
            {record.endTime != null ? (
              <Text style={styles.timingTs}>
                {formatTimestamp(record.endTime)}
              </Text>
            ) : null}
          </View>

          {/* Bar */}
          <View style={styles.timingTrack}>
            <View
              style={[
                styles.timingFill,
                {
                  backgroundColor: sc,
                  opacity: isPending ? 0.45 : 0.8,
                },
              ]}
            />
          </View>

          {/* Duration label below bar */}
          <Text style={[styles.timingDurationLabel, { color: sc }]}>
            {isPending
              ? 'In progress…'
              : (formatDuration(record.duration) ?? '—')}
          </Text>
        </View>
      </CollapsibleSection>

      <CollapsibleSection title="Timestamps">
        <InfoRow label="Started" value={formatTimestamp(record.startTime)} />
        {record.endTime != null ? (
          <InfoRow label="Completed" value={formatTimestamp(record.endTime)} />
        ) : null}
        <InfoRow
          label="Duration"
          value={
            isPending
              ? 'In progress…'
              : (formatDuration(record.duration) ?? '—')
          }
          valueColor={sc}
        />
        <InfoRow label="Platform" value={record.platform} />
      </CollapsibleSection>
    </>
  );
}

function InitiatorPanel({ record }: { record: NetworkRecord }) {
  const { origin, stack } = record;
  return (
    <>
      {origin ? (
        <CollapsibleSection title="Origin">
          <InfoRow
            label="File"
            value={`${origin.file}${origin.line != null ? `:${origin.line}` : ''}`}
            valueColor={colors.accent}
          />
          {origin.methodName ? (
            <InfoRow label="Function" value={origin.methodName} />
          ) : null}
        </CollapsibleSection>
      ) : null}
      {stack ? (
        <CollapsibleSection title="Call Stack">
          <View style={styles.codeWrapper}>
            <CodeBlock text={stack} />
          </View>
        </CollapsibleSection>
      ) : null}
    </>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type Props = { record: NetworkRecord };

export function RequestDetail({ record }: Props) {
  const hasPayload = record.requestBody != null && record.requestBody !== '';
  const hasInitiator = Boolean(record.origin ?? record.stack);

  const visibleTabs = ALL_TABS.filter(({ id }) => {
    if (id === 'payload' && !hasPayload) return false;
    if (id === 'initiator' && !hasInitiator) return false;
    return true;
  });

  const [activeTab, setActiveTab] = useState<TabId>('headers');

  // Snap back to headers if the active tab is no longer visible
  const resolvedTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : 'headers';

  return (
    <View style={styles.container}>
      {/* ── URL bar ─────────────────────────────────────────────────── */}
      <View style={styles.urlBar}>
        <Text style={[styles.urlMethod, { color: methodColor(record.method) }]}>
          {record.method.toUpperCase()}
        </Text>
        <Text style={styles.urlText} selectable numberOfLines={2}>
          {record.url}
        </Text>
      </View>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarInner}
      >
        {visibleTabs.map(({ id, label }) => {
          const active = resolvedTab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setActiveTab(id)}
              style={styles.tabItem}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {label}
              </Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabContentInner}
        keyboardShouldPersistTaps="handled"
      >
        {resolvedTab === 'headers' ? <HeadersPanel record={record} /> : null}
        {resolvedTab === 'payload' ? <PayloadPanel record={record} /> : null}
        {resolvedTab === 'response' ? <ResponsePanel record={record} /> : null}
        {resolvedTab === 'timing' ? <TimingPanel record={record} /> : null}
        {resolvedTab === 'initiator' ? (
          <InitiatorPanel record={record} />
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // URL bar
  urlBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  urlMethod: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: MONO,
    marginTop: 2,
    flexShrink: 0,
  },
  urlText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontFamily: MONO,
    lineHeight: 18,
  },

  // Tab bar
  tabBar: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabBarInner: {
    paddingHorizontal: 6,
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingTop: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: {
    color: colors.subtext,
    fontSize: 13,
    fontWeight: '500',
    paddingBottom: 10,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: colors.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  // Tab content
  tabContent: {
    flex: 1,
  },
  tabContentInner: {
    paddingBottom: 48,
  },

  // Collapsible section
  section: {
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
  sectionHeaderPressed: {
    backgroundColor: colors.card,
  },
  sectionChevron: {
    color: colors.subtext,
    fontSize: 13,
    width: 14,
    textAlign: 'center',
  },
  sectionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionBadge: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionBadgeText: {
    color: colors.subtext,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionBody: {
    backgroundColor: colors.panel,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  infoLabel: {
    width: 110,
    flexShrink: 0,
    color: colors.subtext,
    fontSize: 12,
    lineHeight: 18,
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },

  // Header table rows
  headerRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerKey: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerValue: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },

  // Code block
  codeWrapper: {
    padding: 12,
  },
  codeBlock: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  codeToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 20,
  },
  truncatedWarning: {
    color: colors.yellow,
    fontSize: 11,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  copyBtnPressed: {
    backgroundColor: colors.card,
  },
  copyBtnText: {
    color: colors.subtext,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: MONO,
  },
  copyBtnCopied: {
    color: colors.green,
  },
  code: {
    color: colors.text,
    fontSize: 11,
    fontFamily: MONO,
    lineHeight: 17,
  },

  // Timing panel
  timingWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timingAboveBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  timingTs: {
    color: colors.faint,
    fontSize: 10,
    fontFamily: MONO,
  },
  timingTrack: {
    height: 20,
    backgroundColor: colors.bg,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  timingFill: {
    flex: 1,
  },
  timingDurationLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Empty states
  emptyInSection: {
    color: colors.subtext,
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyTabText: {
    color: colors.faint,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 48,
  },
});
