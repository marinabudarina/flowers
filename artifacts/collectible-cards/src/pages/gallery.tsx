import { BeadCard } from "@/components/bead-card";
import { useState } from "react";

export default function Gallery() {
  const [flipped, setFlipped] = useState(false);
  return (
    <main className="bead-page">
      <nav className="bead-nav" aria-label="Main navigation">
        <a className="bead-brand" href={import.meta.env.BASE_URL}>budarina</a>
        <div className="bead-nav-cards" aria-label="Portfolio navigation">
          <button type="button" disabled>about</button>
          <span aria-hidden="true">/</span>
          <button type="button" disabled>contact</button>
        </div>
      </nav>
      <h1 className="sr-only">Google Antigravity beaded collectible card</h1>
      <p className="bead-type" aria-hidden="true">
        <span>Design</span>
        <span>Week</span>
      </p>
      <div className="bead-showcase">
        <div className="bead-tilt">
          <BeadCard flipped={flipped} onFlippedChange={setFlipped} />
        </div>
        <button
          className="bead-flip-button"
          type="button"
          aria-controls="collectible-card"
          aria-label={flipped ? "Explore Google" : "Explore Argon"}
          onClick={() => setFlipped(value => !value)}
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <path d="M16.5 7A7 7 0 0 0 4 5L2 7m0 0V2m0 5h5M3.5 13A7 7 0 0 0 16 15l2-2m0 0v5m0-5h-5" />
          </svg>
          explore
        </button>
      </div>
    </main>
  );
}
