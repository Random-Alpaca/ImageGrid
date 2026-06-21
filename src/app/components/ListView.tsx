import { ListItem } from "./ListItem";
import type { PortfolioWork } from "../types";

interface ListViewProps {
  listPool: PortfolioWork[];
  onSelect: (work: PortfolioWork) => void;
}

/** Scrollable list view showing each photo once with its metadata. */
export function ListView({ listPool, onSelect }: ListViewProps) {
  return (
    <section key="list" className="relative z-10 h-screen overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl space-y-3 px-4 pb-12 pt-28 md:px-8">
        {listPool.map((item) => (
          <ListItem key={item.id} item={item} onClick={() => onSelect(item)} />
        ))}
      </div>
    </section>
  );
}
