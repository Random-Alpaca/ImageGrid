import { useRef, useEffect, useCallback } from "react";

/**
 * Drives the grid drift via requestAnimationFrame instead of a CSS animation,
 * so wheel events can temporarily speed up, slow down, or reverse the scroll.
 *
 * Returns a ref to attach to the drifting container (which must contain
 * exactly two child elements — two identical grid copies stacked vertically).
 *
 * The drift moves upward at BASE_SPEED px/s. Scrolling down speeds it up,
 * scrolling up slows it down (and can reverse it). The boost decays
 * exponentially back to the base speed over ~1-2 seconds.
 *
 * The wrap period is measured as the distance from the top of the first child
 * to the top of the second child — this gives pixel-perfect seamless looping
 * regardless of padding, margins, or gaps.
 */

/** Base drift speed in pixels per second (upward). */
const BASE_SPEED = 40;

/** How much each wheel delta pixel adds to the boost (px/s per px). */
const WHEEL_GAIN = 1.8;

/** Exponential decay factor per second — higher = faster return to base. */
const DECAY_RATE = 3.0;

/** Clamp boost so the drift can't get absurdly fast. */
const MAX_BOOST = 600;

export function useDriftSpeed(isPaused: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable state kept in a ref so the rAF loop never re-creates.
  const state = useRef({
    offset: 0, // current translateY offset (px, grows negative = upward)
    boost: 0, // extra speed from wheel interaction (px/s, positive = faster upward)
    lastTime: 0, // previous frame timestamp
    rafId: 0, // requestAnimationFrame handle
    height: 0, // wrap period: offset distance between the two grid copies
  });

  // ── Height measurement ────────────────────────────────────────────
  // Measures the distance from the top of child[0] to the top of child[1].
  // This is the exact wrap period needed for seamless looping.
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.children.length < 2) return;
    const first = el.children[0] as HTMLElement;
    const second = el.children[1] as HTMLElement;
    state.current.height = second.offsetTop - first.offsetTop;
  }, []);

  // ── Animation loop ──────────────────────────────────────────────────
  const tick = useCallback(
    (now: number) => {
      const s = state.current;
      if (s.lastTime === 0) s.lastTime = now;

      const dt = Math.min((now - s.lastTime) / 1000, 0.1); // cap at 100ms
      s.lastTime = now;

      if (!isPaused) {
        // Decay the boost toward zero.
        if (Math.abs(s.boost) > 0.5) {
          s.boost *= Math.exp(-DECAY_RATE * dt);
        } else {
          s.boost = 0;
        }

        // Total speed = base + boost. Positive = upward drift.
        const speed = BASE_SPEED + s.boost;
        s.offset -= speed * dt;

        // Wrap seamlessly: keep offset in [-height, 0].
        if (s.height > 0) {
          while (s.offset <= -s.height) s.offset += s.height;
          while (s.offset > 0) s.offset -= s.height;
        }

        // Apply transform directly for performance.
        const el = containerRef.current;
        if (el) {
          el.style.transform = `translateY(${s.offset}px) translateZ(0)`;
        }
      }

      s.rafId = requestAnimationFrame(tick);
    },
    [isPaused],
  );

  // ── Start / stop the loop ───────────────────────────────────────────
  useEffect(() => {
    const s = state.current;
    s.lastTime = 0;
    measure();
    s.rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.rafId);
  }, [tick, measure]);

  // Re-measure when children resize (images load, viewport changes, etc.).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    // Also observe individual grid copies so layout shifts are caught.
    for (const child of Array.from(el.children)) {
      ro.observe(child);
    }
    return () => ro.disconnect();
  }, [measure]);

  // ── Wheel handler ───────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const s = state.current;
    // deltaY > 0 = scroll down = speed up upward drift (positive boost).
    // deltaY < 0 = scroll up   = slow down / reverse (negative boost).
    s.boost = Math.max(
      -MAX_BOOST,
      Math.min(MAX_BOOST, s.boost + e.deltaY * WHEEL_GAIN),
    );
  }, []);

  // Attach the wheel listener (must be non-passive to preventDefault).
  useEffect(() => {
    const el = containerRef.current?.parentElement; // the overflow-hidden wrapper
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  return containerRef;
}
