import { useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors } from './theme';

const SIZE = 56;
const MARGIN = 14;
const TOP_INSET = 52;
const BOTTOM_INSET = 40;
const TAP_MAX_MS = 300;
const MOVE_THRESHOLD = 4;

type Position = { x: number; y: number };

// Persisted across mounts so the bubble keeps its place.
let savedPosition: Position | null = null;

type Props = {
  count: number;
  color?: string;
  hasError?: boolean;
  onPress: () => void;
};

export function FloatingBubble({ count, color, hasError, onPress }: Props) {
  const { width, height } = useWindowDimensions();

  const initial: Position = savedPosition ?? {
    x: width - SIZE - MARGIN,
    y: height * 0.45,
  };
  const pan = useRef(new Animated.ValueXY(initial)).current;
  const posRef = useRef<Position>(initial);
  const gesture = useRef({ startedAt: 0, moved: false });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > MOVE_THRESHOLD || Math.abs(g.dy) > MOVE_THRESHOLD,
      onPanResponderGrant: () => {
        gesture.current = { startedAt: Date.now(), moved: false };
      },
      onPanResponderMove: (_evt, g) => {
        if (
          Math.abs(g.dx) > MOVE_THRESHOLD ||
          Math.abs(g.dy) > MOVE_THRESHOLD
        ) {
          gesture.current.moved = true;
        }
        pan.setValue({
          x: posRef.current.x + g.dx,
          y: posRef.current.y + g.dy,
        });
      },
      onPanResponderRelease: (_evt, g) => {
        const elapsed = Date.now() - gesture.current.startedAt;
        if (!gesture.current.moved && elapsed < TAP_MAX_MS) {
          onPress();
          return;
        }

        const rawX = posRef.current.x + g.dx;
        const rawY = posRef.current.y + g.dy;
        const clampedY = Math.max(
          TOP_INSET,
          Math.min(height - SIZE - BOTTOM_INSET, rawY)
        );
        const snapLeft = MARGIN;
        const snapRight = width - SIZE - MARGIN;
        const snappedX = rawX + SIZE / 2 < width / 2 ? snapLeft : snapRight;

        const next = { x: snappedX, y: clampedY };
        posRef.current = next;
        savedPosition = next;
        Animated.spring(pan, {
          toValue: next,
          useNativeDriver: false,
          friction: 6,
          tension: 80,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      accessibilityRole="button"
      accessibilityLabel="Open network inspector"
      style={[styles.bubble, pan.getLayout()]}
      {...responder.panHandlers}
    >
      <View
        style={[
          styles.inner,
          color ? { backgroundColor: color } : null,
          hasError ? { backgroundColor: colors.red } : null,
        ]}
        pointerEvents="none"
      >
        <Text style={styles.glyph}>⇅</Text>
        {count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    zIndex: 999999,
  },
  inner: {
    flex: 1,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  glyph: {
    color: colors.onAccent,
    fontSize: 24,
    fontWeight: '800',
    marginTop: -2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
