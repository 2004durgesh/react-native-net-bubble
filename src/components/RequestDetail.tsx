import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NetworkRecord } from '../types';
import { colors, formatDuration, methodColor, statusColor } from './theme';

type Props = {
  record: NetworkRecord;
};

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

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
      >
        {value}
      </Text>
    </View>
  );
}

function HeaderList({ headers }: { headers?: Record<string, string> }) {
  const entries = headers ? Object.entries(headers) : [];
  if (entries.length === 0) {
    return <Text style={styles.muted}>No headers</Text>;
  }
  return (
    <View>
      {entries.map(([key, value]) => (
        <View key={key} style={styles.headerRow}>
          <Text style={styles.headerKey} selectable>
            {key}
          </Text>
          <Text style={styles.headerValue} selectable>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CodeBlock({ text, truncated }: { text: string; truncated?: boolean }) {
  if (!text) {
    return <Text style={styles.muted}>Empty</Text>;
  }
  return (
    <View style={styles.codeBlock}>
      <Text style={styles.code} selectable>
        {text}
      </Text>
      {truncated ? (
        <Text style={styles.truncated}>
          — body truncated (increase maxBodyBytes to capture more) —
        </Text>
      ) : null}
    </View>
  );
}

export function RequestDetail({ record }: Props) {
  const origin = record.origin;
  const started = new Date(record.startTime);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.urlHeader}>
        <Text style={[styles.method, { color: methodColor(record.method) }]}>
          {record.method.toUpperCase()}
        </Text>
        <Text style={styles.url} selectable>
          {record.url}
        </Text>
      </View>

      <Section title="General">
        <InfoRow
          label="Status"
          value={
            record.state === 'pending'
              ? 'Pending…'
              : `${record.status ?? ''} ${record.statusText ?? ''}`.trim() ||
                (record.state === 'error' ? 'Error' : '—')
          }
          valueColor={statusColor(record.status, record.state)}
        />
        <InfoRow
          label="Duration"
          value={formatDuration(record.duration) || '—'}
        />
        <InfoRow label="Started" value={started.toLocaleTimeString()} />
        <InfoRow label="Platform" value={record.platform} />
        {record.contentType ? (
          <InfoRow label="Content-Type" value={record.contentType} />
        ) : null}
        {record.error ? (
          <InfoRow label="Error" value={record.error} valueColor={colors.red} />
        ) : null}
      </Section>

      {origin ? (
        <Section title="Originated from">
          <InfoRow
            label="File"
            value={`${origin.file}${origin.line != null ? `:${origin.line}` : ''}`}
            valueColor={colors.accent}
          />
          {origin.methodName ? (
            <InfoRow label="Function" value={origin.methodName} />
          ) : null}
        </Section>
      ) : null}

      <Section title="Request Headers">
        <HeaderList headers={record.requestHeaders} />
      </Section>

      {record.requestBody != null ? (
        <Section title="Request Body">
          <CodeBlock
            text={prettyBody(record.requestBody, record.contentType)}
            truncated={record.requestBodyTruncated}
          />
        </Section>
      ) : null}

      <Section title="Response Headers">
        <HeaderList headers={record.responseHeaders} />
      </Section>

      <Section title="Response Body">
        <CodeBlock
          text={prettyBody(record.responseBody, record.contentType)}
          truncated={record.responseBodyTruncated}
        />
      </Section>

      {record.stack ? (
        <Section title="Call stack">
          <CodeBlock text={record.stack} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  urlHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  method: {
    fontSize: 13,
    fontWeight: '800',
    marginRight: 8,
    marginTop: 1,
  },
  url: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  sectionTitle: {
    color: colors.subtext,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    width: 108,
    color: colors.subtext,
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  headerRow: {
    marginBottom: 8,
  },
  headerKey: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  headerValue: {
    color: colors.text,
    fontSize: 12,
    marginTop: 1,
  },
  codeBlock: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 10,
  },
  code: {
    color: colors.text,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    lineHeight: 17,
  },
  truncated: {
    color: colors.yellow,
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  muted: {
    color: colors.faint,
    fontSize: 13,
    fontStyle: 'italic',
  },
});
