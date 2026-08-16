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

const API = 'https://jsonplaceholder.typicode.com';

async function getUsers(): Promise<void> {
  await fetch(`${API}/users`);
}

async function getTodo(): Promise<void> {
  await fetch(`${API}/todos/1`);
}

async function createPost(): Promise<void> {
  await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hello', body: 'from NetBubble', userId: 1 }),
  });
}

async function notFound(): Promise<void> {
  await fetch(`${API}/nope/404`);
}

async function failRequest(): Promise<void> {
  await fetch('https://this-host-does-not-exist.invalid/api');
}

type LogEntry = { id: number; text: string };

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  const append = useCallback((text: string) => {
    setLog((prev) => [{ id: nextId.current++, text }, ...prev].slice(0, 10));
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
        <Text style={styles.title}>react-native-net-bubble</Text>
        <Text style={styles.subtitle}>
          Fire a request, then tap the floating bubble to inspect it.
        </Text>

        <Button label="GET /users" onPress={run('GET /users', getUsers)} />
        <Button label="GET /todos/1" onPress={run('GET /todos/1', getTodo)} />
        <Button label="POST /posts" onPress={run('POST /posts', createPost)} />
        <Button label="GET 404" onPress={run('GET 404', notFound)} />
        <Button
          label="Failing request"
          onPress={run('Failing request', failRequest)}
        />

        <View style={styles.log}>
          {log.map((entry) => (
            <Text key={entry.id} style={styles.logLine}>
              {entry.text}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* Mount once near the root. In a real app, gate with your env flag:
          <NetBubble enabled={getApiBaseUrl() !== PROD_BASE_URL} /> */}
      <NetBubble enabled />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f14',
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    color: '#e6edf3',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8b98a5',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4c8dff',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  log: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#12181f',
    borderRadius: 10,
    minHeight: 80,
  },
  logLine: {
    color: '#c9d4de',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 3,
  },
});
