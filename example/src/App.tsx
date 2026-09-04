import { useCallback, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NetBubble } from 'react-native-net-bubble';

// ─── API helpers ─────────────────────────────────────────────────────────────
// Each function is intentionally isolated so the Initiator tab in the
// inspector shows the exact file:line that triggered each request.

const API = 'https://jsonplaceholder.typicode.com';

// ── 2xx ──────────────────────────────────────────────────────────────────────

async function getUsers(): Promise<void> {
  await fetch(`${API}/users`);
}

async function getPost(): Promise<void> {
  await fetch(`${API}/posts/1`);
}

async function getTodo(): Promise<void> {
  await fetch(`${API}/todos/1`);
}

// Demonstrates: POST with JSON body + custom headers.
// Open Payload + Headers tabs in the inspector to inspect.
async function createPost(): Promise<void> {
  await fetch(`${API}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer example-token-abc123',
      'X-Client-Version': '1.0.0',
    },
    body: JSON.stringify({
      title: 'Hello from NetBubble',
      body: 'Tap the Headers tab to see the Authorization header.',
      userId: 1,
    }),
  });
}

// Demonstrates: PUT with a body.
async function updatePost(): Promise<void> {
  await fetch(`${API}/posts/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      title: 'Updated',
      body: 'PUT body here',
      userId: 1,
    }),
  });
}

// Demonstrates: DELETE (no response body).
async function deletePost(): Promise<void> {
  await fetch(`${API}/posts/1`, { method: 'DELETE' });
}

// ── 4xx / errors ─────────────────────────────────────────────────────────────

// Bubble turns red and shows ERR chip when this fires.
async function notFound(): Promise<void> {
  await fetch(`${API}/nope/does-not-exist`);
}

// Hard network failure — DNS error, no HTTP response at all.
async function networkError(): Promise<void> {
  await fetch('https://this-host-does-not-exist.invalid/api');
}

// ── Batch / chained ──────────────────────────────────────────────────────────

// Fire three requests back-to-back to fill the list quickly.
async function batchRequests(): Promise<void> {
  await Promise.all([
    fetch(`${API}/users/1`),
    fetch(`${API}/users/2`),
    fetch(`${API}/users/3`),
  ]);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

type LogEntry = { id: number; text: string };

function Button({
  label,
  subtitle,
  color = '#4c8dff',
  onPress,
}: {
  label: string;
  subtitle?: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.buttonText}>{label}</Text>
      {subtitle ? <Text style={styles.buttonSub}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  const append = useCallback((text: string) => {
    setLog((prev) => [{ id: nextId.current++, text }, ...prev].slice(0, 12));
  }, []);

  const run = useCallback(
    (name: string, fn: () => Promise<void>) => () => {
      append(`▶ ${name}`);
      fn()
        .then(() => append(`✓ ${name}`))
        .catch((e: unknown) => append(`✗ ${name}: ${String(e)}`));
    },
    [append]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.title}>react-native-net-bubble</Text>
        <Text style={styles.subtitle}>
          Tap a button to fire a request, then tap the{' '}
          <Text style={styles.accent}>floating bubble</Text> to inspect it.{' '}
          <Text style={styles.accent}>Long-press</Text> any row to copy as cURL
          or fetch.
        </Text>

        {/* 2xx */}
        <SectionTitle>GET requests (2xx)</SectionTitle>
        <Button label="GET /users" onPress={run('GET /users', getUsers)} />
        <Button label="GET /posts/1" onPress={run('GET /posts/1', getPost)} />
        <Button label="GET /todos/1" onPress={run('GET /todos/1', getTodo)} />

        {/* Write requests */}
        <SectionTitle>Write requests</SectionTitle>
        <Button
          label="POST /posts"
          subtitle="JSON body + Authorization header"
          onPress={run('POST /posts', createPost)}
        />
        <Button
          label="PUT /posts/1"
          subtitle="Update body"
          onPress={run('PUT /posts/1', updatePost)}
        />
        <Button
          label="DELETE /posts/1"
          subtitle="No response body"
          onPress={run('DELETE /posts/1', deletePost)}
        />

        {/* Error states — bubble turns red */}
        <SectionTitle>Error states (bubble turns red 🔴)</SectionTitle>
        <Button
          label="GET 404"
          subtitle="Bubble turns red"
          color="#c62828"
          onPress={run('GET 404', notFound)}
        />
        <Button
          label="Network error"
          subtitle="Bad host — DNS failure"
          color="#c62828"
          onPress={run('Network error', networkError)}
        />

        {/* Batch */}
        <SectionTitle>Batch</SectionTitle>
        <Button
          label="3 parallel GETs"
          subtitle="Fires /users/1, /users/2, /users/3 simultaneously"
          color="#6a3fa0"
          onPress={run('3 parallel GETs', batchRequests)}
        />

        {/* Log */}
        <View style={styles.log}>
          <Text style={styles.logHeader}>Activity log</Text>
          {log.length === 0 ? (
            <Text style={styles.logEmpty}>No activity yet</Text>
          ) : (
            log.map((entry) => (
              <Text key={entry.id} style={styles.logLine}>
                {entry.text}
              </Text>
            ))
          )}
        </View>

        {/* Tips */}
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Inspector tips</Text>
          <Text style={styles.tip}>
            📋 <Text style={styles.accent}>Long-press</Text> any row → Copy as
            cURL (bash / cmd), fetch, or raw response body
          </Text>
          <Text style={styles.tip}>
            🔍 <Text style={styles.accent}>Search bar</Text> filters by URL,
            method, file, or status code
          </Text>
          <Text style={styles.tip}>
            🏷 <Text style={styles.accent}>Status chips</Text> → All · 2xx · 3xx
            · 4xx · 5xx · ERR
          </Text>
          <Text style={styles.tip}>
            📂 <Text style={styles.accent}>Initiator tab</Text> shows the exact
            source file:line that fired the request
          </Text>
          <Text style={styles.tip}>
            ⏱ <Text style={styles.accent}>Timing tab</Text> shows start/end at
            millisecond precision with a colour-coded bar
          </Text>
          <Text style={styles.tip}>
            📤 <Text style={styles.accent}>Export</Text> (top-right) shares the
            full session as JSON
          </Text>
        </View>
      </ScrollView>

      {/* Mount once near the root.
          In a real app, gate with your env flag:
            <NetBubble enabled={getApiBaseUrl() !== PROD_BASE_URL} /> */}
      <NetBubble enabled />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f14',
  },
  content: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },

  // Header
  title: {
    color: '#e6edf3',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#8b98a5',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  accent: {
    color: '#4c8dff',
    fontWeight: '600',
  },

  // Section
  section: {
    color: '#5c6a78',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },

  // Buttons
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 2,
  },

  // Log
  log: {
    marginTop: 28,
    padding: 14,
    backgroundColor: '#12181f',
    borderRadius: 10,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#1e2b38',
  },
  logHeader: {
    color: '#5c6a78',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  logEmpty: {
    color: '#3d4f60',
    fontSize: 12,
    fontStyle: 'italic',
  },
  logLine: {
    color: '#c9d4de',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 3,
  },

  // Tips
  tips: {
    marginTop: 28,
    padding: 14,
    backgroundColor: '#0e1820',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a2840',
  },
  tipsTitle: {
    color: '#4c8dff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  tip: {
    color: '#8b98a5',
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 4,
  },
});
