# react-native-net-bubble

A self-contained, in-app network inspector for React Native.

A draggable **floating bubble** lives on top of every screen. Tap it and a
live, DevTools-style **Network panel** slides up — every request as it happens:
URL, method, headers, request/response bodies, status, and timing. No cable, no
laptop, no Metro session required.

The clever bit: each request also tells you **which file in your codebase fired
it** (e.g. `ProfileScreen.tsx:84`), so you're never guessing where a rogue call
came from.

> **New Architecture only.** This is a pure TurboModule (Codegen spec + event
> emitter). It requires React Native **0.79+** with the New Architecture enabled
> (the default on modern RN).

---

## Why it's different

- **Native interception, not JS patching.** Requests are captured with an
  **OkHttp `Interceptor` on Android** and an **`NSURLProtocol` on iOS**, tapping
  React Native's own networking clients. This catches far more than a
  `fetch`/`XHR` monkey-patch would — including native SDK traffic that rides the
  RN client.
- **File-of-origin built in.** The JS call-site stack is captured at request
  time and correlated to the native request, then symbolicated to a source
  location.
- **Zero-infra gating.** Reuse the env flag you already have (the one that swaps
  your API base URL between dev/QA/prod). If it's prod, the bubble never mounts
  and native capture never turns on.
- **No third-party runtime dependencies.** Just React Native.

---

## Install

```sh
npm install react-native-net-bubble
# or
yarn add react-native-net-bubble
```

Then rebuild the app (native code changed):

```sh
# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

Autolinking + Codegen handle the rest. There is nothing to register in
`MainApplication` or `AppDelegate`.

---

## Usage

Mount `<NetBubble />` once, near the root of your app, as the **last** child so
it floats above everything:

```tsx
import { NetBubble } from 'react-native-net-bubble';

export default function App() {
  return (
    <>
      <RootNavigator />
      <NetBubble enabled={getApiBaseUrl() !== PROD_BASE_URL} />
    </>
  );
}
```

When `enabled` resolves to `false`, `NetBubble` renders nothing and never starts
native interception — in production it is effectively absent.

### Gating options

```tsx
// 1. Explicit boolean (recommended — wire to your own env flag)
<NetBubble enabled={getApiBaseUrl() !== PROD_BASE_URL} />

// 2. Let the library compare base URLs for you
<NetBubble baseUrl={getApiBaseUrl()} prodBaseUrl={PROD_BASE_URL} />

// 3. Omit everything → defaults to __DEV__
<NetBubble />
```

### Props

| Prop           | Type      | Default    | Description                                        |
| -------------- | --------- | ---------- | -------------------------------------------------- |
| `enabled`      | `boolean` | `__DEV__`  | Master switch. Wins over `baseUrl`/`prodBaseUrl`.  |
| `baseUrl`      | `string`  | –          | Current API base URL (used with `prodBaseUrl`).    |
| `prodBaseUrl`  | `string`  | –          | If `baseUrl === prodBaseUrl`, the inspector is off. |
| `maxBodyBytes` | `number`  | `1048576`  | Max body bytes captured per request (1 MiB).       |
| `maxRecords`   | `number`  | `500`      | Max records kept in memory.                        |
| `bubbleColor`  | `string`  | brand blue | Bubble background color.                            |

---

## File-of-origin & symbolication

Out of the box you get the **function name** plus a bundle location for each
request. To turn that into a precise `ProfileScreen.tsx:84`:

- **In development**, if the app is connected to Metro, the library
  automatically uses Metro's `/symbolicate` endpoint — you get real file names
  with no setup.
- **In QA / release-style builds without Metro**, supply a source map. Bundle
  the `.map` into your non-prod builds and register a resolver:

```ts
import { configureSymbolication } from 'react-native-net-bubble';
import { SourceMapConsumer } from 'source-map-js'; // add this dep yourself
import sourceMapJson from './app.bundle.map.json';

const consumer = new SourceMapConsumer(sourceMapJson);

configureSymbolication({
  resolveFrame: (frame) => {
    if (frame.line == null) return undefined;
    const pos = consumer.originalPositionFor({
      line: frame.line,
      column: frame.column ?? 0,
    });
    if (!pos.source) return undefined;
    return {
      file: pos.source.replace(/^.*\/src\//, 'src/'),
      line: pos.line ?? undefined,
      column: pos.column ?? undefined,
      methodName: pos.name ?? frame.methodName,
      raw: frame.raw,
    };
  },
});
```

Because prod is gated out entirely, this source map only ever ships in builds
that already exclude real users.

---

## Build your own UI

The default bubble + panel are optional. Subscribe to the same live data and
render whatever you like:

```tsx
import { useNetworkRequests, networkStore } from 'react-native-net-bubble';

function MyInspector() {
  const requests = useNetworkRequests(); // NetworkRecord[]
  // ...render, and call networkStore.clear() to reset
}
```

`InspectorPanel`, `RequestList`, `RequestDetail`, and `FloatingBubble` are also
exported if you want to compose them differently.

---

## How it works

```
 JS call site ──► XMLHttpRequest.open  ──► (stack captured, held by method+url+time)
      │                                              │
      ▼                                              ▼ correlate
 fetch()/XHR ──► RN networking ──► OkHttp / NSURLSession
                                        │
                     OkHttp Interceptor / NSURLProtocol  (native capture)
                                        │
                          Codegen EventEmitter (onNetworkEvent)
                                        │
                                   NetworkStore ──► useNetworkRequests ──► UI
```

- **Android:** `NetBubbleInterceptor` is registered on RN's OkHttp client via
  `OkHttpClientProvider` at app startup. It's a passthrough until JS calls
  `start()`.
- **iOS:** `NetBubbleURLProtocol` is injected into `NSURLSession` by swizzling
  `[NSURLSessionConfiguration defaultSessionConfiguration]`. It declines every
  request until `start()` is called.
- **Gating:** `start()` is only ever called when `enabled` is truthy, so nothing
  is captured or emitted in production.

---

## Limitations

- **New Architecture only** (TurboModule + Codegen event emitter).
- **WebView traffic is not captured.** `WKWebView` (iOS) runs out of process;
  Android `WebView` and image pipelines (Fresco) use their own HTTP stacks.
- **File-of-origin covers JS-initiated requests.** Purely native-initiated
  traffic has no JS stack to attribute.
- Bodies are captured up to `maxBodyBytes`; binary content types are skipped.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The `example/` app is a full RN app wired
to consume the library source directly — run it with `yarn example ios` /
`yarn example android`.

## License

MIT
