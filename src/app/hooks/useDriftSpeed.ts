import { useRef, useEffect, useCallback } from "react";

/**
 * Drives the grid drift via requestAnimationFrame instead of a CSS animation,
 * so wheel events can temporarily speed up, slow down, or reverse the scroll.
 *
 * Returns a ref to attach to the drifting container and a wheel handler.
 *
 * The drift moves upward at BASE_SPEED px/s. Scrolling down speeds it up,
 * scrolling up slows it down (and can reverse it). The boost decays
 * exponentially back to the base speed over ~1-2 seconds.
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
    offset: 0,        // current translateY offset (px, grows negative = upward)
    boost: 0,         // extra speed from wheel interaction (px/s, positive = faster upward)
    lastTime: 0,      // previous frame timestamp
    rafId: 0,         // requestAnimationFrame handle
    height: 0,        // content height / 2 (the wrap point)
  });

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

        // Wrap seamlessly: the grid content is duplicated so -50% loops.
        if (s.height > 0) {
          // Wrap around when we've scrolled past half the content
          if (s.offset <= -s.height) {
            s.offset += s.height;
          } else if (s.offset > 0) {
            s.offset -= s.height;
          }
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
    s.rafId = requestAnimationFrame(tick);

    // Measure content height (the grid renders its items twice for the loop).
    const el = containerRef.current;
    if (el) {
      // scrollHeight is the full duplicated content; half of it is the wrap point.
      s.height = el.scrollHeight / 2;
    }

    return () => cancelAnimationFrame(s.rafId);
  }, [tick]);

  // Re-measure height when children change (images load, pool changes).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      state.current.height = el.scrollHeight / 2;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
