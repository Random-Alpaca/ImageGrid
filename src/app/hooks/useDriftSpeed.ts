import { useRef, useEffect, useCallback } from "react";

/**
 * Drives the grid drift via requestAnimationFrame instead of a CSS animation,
 * so wheel events can temporarily speed up, slow down, or reverse the scroll.
 *
 * Returns a ref to attach to the drifting container (which must be a single
 * CSS grid containing exactly three consecutive copies of the image pool).
 *
 * The drift moves upward at BASE_SPEED px/s. Scrolling down speeds it up,
 * scrolling up slows it down (and can reverse it). The boost decays
 * exponentially back to the base speed over ~1-2 seconds.
 *
 * The wrap period is measured as the distance from the top of the middle copy
 * to the top of the last copy. This gives pixel-perfect seamless looping
 * without any layout seams or gaps.
 */

/** Base drift speed in pixels per second (upward). */
const BASE_SPEED = 40;

/** How much each wheel delta pixel adds to the boost (px/s per px). */
const WHEEL_GAIN = 1.8;

/** Exponential decay factor per second — higher = faster return to base. */
const DECAY_RATE = 3.0;

export function useDriftSpeed(
  isPaused: boolean,
  poolSize: number,
  onScroll?: () => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable state kept in a ref so the rAF loop never re-creates.
  const state = useRef({
    offset: 0, // current translateY offset (px, grows negative = upward)
    boost: 0, // extra speed from wheel interaction (px/s, positive = faster upward)
    lastTime: 0, // previous frame timestamp
    rafId: 0, // requestAnimationFrame handle
    height: 0, // wrap period: vertical size of one full image pool iteration
    center: 0, // offset of the middle iteration's start
  });

  // ── Height/Center measurement ──────────────────────────────────────
  // Finds the first elements of the 1st, 2nd and 3rd iterations inside the
  // single grid container, and measures the layout height of one iteration.
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.children.length < 3 * poolSize) return;

    const first = el.children[0] as HTMLElement;
    const middle = el.children[poolSize] as HTMLElement;
    const last = el.children[2 * poolSize] as HTMLElement;

    state.current.height = last.offsetTop - middle.offsetTop;
    state.current.center = middle.offsetTop;
  }, [poolSize]);

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

        // Wrap seamlessly: keep offset in [-(center + height), -center].
        if (s.height > 0) {
          const minOffset = -(s.center + s.height);
          const maxOffset = -s.center;
          while (s.offset < minOffset) s.offset += s.height;
          while (s.offset > maxOffset) s.offset -= s.height;
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

    // Initialize offset to the start of the middle iteration.
    if (s.offset === 0 && s.center > 0) {
      s.offset = -s.center;
    }

    s.rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.rafId);
  }, [tick, measure]);

  // Re-measure when children resize (images load, viewport changes, etc.).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);
    for (const child of Array.from(el.children)) {
      ro.observe(child);
    }
    return () => ro.disconnect();
  }, [measure]);

  // ── Wheel handler ───────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const s = state.current;

      // Infinite speedup: no clamp on boost!
      s.boost = s.boost + e.deltaY * WHEEL_GAIN;

      if (onScroll) {
        onScroll();
      }
    },
    [onScroll],
  );

  // Attach the wheel listener (must be non-passive to preventDefault).
  useEffect(() => {
    const el = containerRef.current?.parentElement; // the overflow-hidden wrapper
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  return containerRef;
}
