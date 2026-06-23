import { useCallback, useState } from "react";
import { AnimatePresence } from "motion/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

import { usePhotos } from "./hooks/usePhotos";
import { useExif } from "./hooks/useExif";
import { useCategoriesPanel } from "./hooks/useCategoriesPanel";

import { TopScrim } from "./components/TopScrim";
import { NavigationHeader } from "./components/NavigationHeader";
import { GridView } from "./components/GridView";
import { ListView } from "./components/ListView";
import { PhotoModal } from "./components/PhotoModal";

import type { PortfolioWork } from "./types";

export default function App() {
  const { portfolioNames, hidden, imagePool, listPool, togglePortfolio } = usePhotos();
  const { portfoliosOpen, setPortfoliosOpen, openOnHover, toggleOnClick } = useCategoriesPanel();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<PortfolioWork | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const exif = useExif(selected);

  const toggleView = useCallback(() => {
    setSelected(null);
    setIsClosing(false);
    setView((v) => (v === "grid" ? "list" : "grid"));
  }, []);

  const openModal = useCallback((work: PortfolioWork) => {
    setIsClosing(false);
    setSelected(work);
  }, []);

  const closeModal = () => {
    if (!selected || isClosing) return;
    setIsClosing(true);
    // 280ms: just long enough for the caption exit (0.24s) to finish before
    // the backdrop fade and layoutId fly-back start — all three then overlap.
    window.setTimeout(() => {
      setSelected(null);
      setIsClosing(false);
    }, 280);
  };

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <TopScrim expanded={portfoliosOpen} />

      <NavigationHeader
        portfolioNames={portfolioNames}
        hidden={hidden}
        portfoliosOpen={portfoliosOpen}
        setPortfoliosOpen={setPortfoliosOpen}
        openOnHover={openOnHover}
        toggleOnClick={toggleOnClick}
        togglePortfolio={togglePortfolio}
        view={view}
        onToggleView={toggleView}
      />

      <AnimatePresence mode="wait">
        {view === "grid" ? (
          <GridView
            imagePool={imagePool}
            isPaused={selected !== null}
            onSelect={openModal}
          />
        ) : (
          <ListView listPool={listPool} onSelect={openModal} />
        )}
      </AnimatePresence>

      <PhotoModal
        selected={selected}
        isClosing={isClosing}
        exif={exif}
        onClose={closeModal}
      />

      <SpeedInsights />
      <Analytics />
    </main>
  );
}
