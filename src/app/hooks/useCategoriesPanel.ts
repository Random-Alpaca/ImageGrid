import { useEffect, useState, useRef } from "react";

/**
 * Manages the categories dropdown panel:
 * - `portfoliosOpen` state
 * - Escape key dismissal
 * - Mouse-tracking catch zone (closes when cursor exits the gradient area)
 */
export function useCategoriesPanel() {
  const [portfoliosOpen, setPortfoliosOpen] = useState(false);
  const hoverOpenTimeRef = useRef<number>(0);

  const openOnHover = () => {
    if (!portfoliosOpen) {
      hoverOpenTimeRef.current = Date.now();
      setPortfoliosOpen(true);
    }
  };

  const toggleOnClick = () => {
    if (portfoliosOpen) {
      const timeSinceHover = Date.now() - hoverOpenTimeRef.current;
      if (timeSinceHover < 1000) {
        return;
      }
      setPortfoliosOpen(false);
    } else {
      setPortfoliosOpen(true);
    }
  };

  // Escape key closes the panel.
  useEffect(() => {
    if (!portfoliosOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPortfoliosOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [portfoliosOpen]);

  // Mouse-tracking catch zone: keeps the panel open as long as the pointer
  // stays above the gradient bottom and within horizontal bounds.
  useEffect(() => {
    if (!portfoliosOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      const headerWidth = 896; // max-w-4xl
      const padding = 16; // inset-x-4
      const buffer = 120; // horizontal buffer

      const screenWidth = window.innerWidth;
      const leftBound = Math.max(padding, (screenWidth - headerWidth) / 2);
      const rightBound = screenWidth - leftBound;

      const isBelowGradient = e.clientY > 285;
      const isTooFarLeft = e.clientX < leftBound - buffer;
      const isTooFarRight = e.clientX > rightBound + buffer;

      if (isBelowGradient || isTooFarLeft || isTooFarRight) {
        setPortfoliosOpen(false);
      }
    };

    const handleMouseLeaveDoc = () => setPortfoliosOpen(false);

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeaveDoc);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeaveDoc);
    };
  }, [portfoliosOpen]);

  return { portfoliosOpen, setPortfoliosOpen, openOnHover, toggleOnClick };
}
