// Main entry point.
export { NetBubble } from './components/NetBubble';
export type { NetBubbleProps } from './components/NetBubble';

// Compose your own UI on top of the same live data.
export { InspectorPanel } from './components/InspectorPanel';
export { FloatingBubble } from './components/FloatingBubble';
export { RequestList } from './components/RequestList';
export { RequestDetail } from './components/RequestDetail';
export { useNetworkRequests } from './hooks/useNetworkRequests';
export { networkStore } from './store/NetworkStore';

// Gating helpers.
export { isInspectorEnabled } from './core/gating';
export type { GatingOptions } from './core/gating';

// File-of-origin / symbolication.
export { configureSymbolication } from './core/symbolication';
export type { SourceMapResolver, StackFrame } from './core/symbolication';

// Domain types.
export type {
  NetworkRecord,
  NetworkRequestState,
  RequestOrigin,
} from './types';
