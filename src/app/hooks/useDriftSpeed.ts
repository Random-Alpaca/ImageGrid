import { useRef, useEffect, useCallback } from "react";

/**
 * Drives the grid drift via requestAnimationFrame instead of a CSS animation,
 * so wheel events can temporarily speed up, slow down, or reverse the scroll.
 *
 * Returns a ref to attach to a flex-column wrapper that contains exactly three
 * identical grid containers stacked vertically with consistent gap spacing.
 *
 * The drift moves upward at BASE_SPEED px/s. Scrolling down speeds it up,
 * scrolling up slows it down (and can reverse it). The boost decays
 * exponentially back to the base speed over ~1-2 seconds.
 *
 * The wrap period is measured as the distance from the first container's
 * offsetTop to the second container's offsetTop. Because all three containers
 * have identical CSS Grid layouts (each is an independent grid with the same
 * items and spans), wrapping by this period produces a pixel-perfect seamless
 * visual loop.
 */

/** Base drift speed in pixels per second (upward). */
const BASE_SPEED = 40;

/** How much each wheel delta pixel adds to the boost (px/s per px). */
const WHEEL_GAIN = 0.5;

/** Exponential decay factor per second — higher = faster return to base. */
const DECAY_RATE = 3.0;

export function useDriftSpeed(
  isPaused: boolean,
  onScroll?: () => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable state kept in a ref so the rAF loop never re-creates.
  const state = useRef({
    offset: 0, // current translateY offset (px, grows negative = upward)
    boost: 0, // extra speed from wheel interaction (px/s, positive = faster upward)
    lastTime: 0, // previous frame timestamp
    rafId: 0, // requestAnimationFrame handle
    height: 0, // wrap period: distance from grid 0 start to grid 1 start
    center: 0, // offset of the middle grid container's top
  });

  // ── Measurement ───────────────────────────────────────────────────
  // The container has 3 child divs (the 3 grid copies). We measure
  // the distance between the first two to get the wrap period.
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.children.length < 3) return;
    const first = el.children[0] as HTMLElement;
    const second = el.children[1] as HTMLElement;
    state.current.height = second.offsetTop - first.offsetTop;
    state.current.center = second.offsetTop;
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

        // Wrap seamlessly: keep offset in [-(center + height), -center].
        // The viewport always shows the area around the middle container.
        // Because all three containers have identical layouts, wrapping
        // by `height` (one container + gap) is visually undetectable.
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

    // Initialize offset to the start of the middle container.
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

    const ro = new ResizeObserver(() => measure());
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

      // No clamp — infinite speedup allowed.
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
