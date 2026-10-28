import { useState } from "react";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

export const BOUQUETS = [
  { id: "poppy-field", name: "The Poppy Field", stems: "Red poppies, lotus pods, oat grass", note: "Loose and bright, like the card itself." },
  { id: "quiet-lotus", name: "Quiet Lotus", stems: "Lotus pods, dried bunny tails, pale statice", note: "Muted, architectural, lasts for months." },
  { id: "late-garden", name: "Late Garden", stems: "Garden roses, poppy heads, wild fennel", note: "Soft heads with a little wildness at the edges." },
  { id: "signature", name: "Budarina Signature", stems: "The florist's pick of the week", note: "Whatever is most beautiful on the day it is made." },
] as const;

export function BouquetPicker({ recipient, onClose }: { recipient: string; onClose: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const picked = BOUQUETS.find(b => b.id === choice);

  if (confirmed && picked) {
    return (
      <div className="fs-pick-done" data-testid="panel-bouquet-confirmed">
        <span className="fs-pick-kicker">Demo confirmation</span>
        <DialogTitle>{picked.name}</DialogTitle>
        <DialogDescription>
          {recipient ? `${recipient}, this` : "This"} is the bouquet you picked. This is a demo preview only: no order has been placed, nothing was charged, and no gift balance exists or was used.
        </DialogDescription>
        <p className="fs-pick-stems" data-testid="text-bouquet-confirmed">{picked.stems}</p>
        <div className="fs-pick-actions">
          <button className="fs-pick-ghost" onClick={() => setConfirmed(false)} data-testid="button-bouquet-change">Choose another</button>
          <button className="fs-dialog-btn" onClick={onClose} data-testid="button-bouquet-close">Back to the card</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <span className="fs-pick-kicker">Demo / no order is placed</span>
      <DialogTitle>Pick a bouquet</DialogTitle>
      <DialogDescription>Explore four sample arrangements. Choose the one that feels like you.</DialogDescription>
      <div className="fs-pick-list" role="radiogroup" aria-label="Bouquets">
        {BOUQUETS.map((b, n) => (
          <button
            key={b.id}
            role="radio"
            aria-checked={choice === b.id}
            className="fs-pick-item"
            onClick={() => setChoice(b.id)}
            data-testid={`button-bouquet-${b.id}`}
          >
            <span className="fs-pick-no">{String(n + 1).padStart(2, "0")}</span>
            <span className="fs-pick-body">
              <strong>{b.name}</strong>
              <small>{b.stems}</small>
              <em>{b.note}</em>
            </span>
            <span className="fs-pick-dot" aria-hidden />
          </button>
        ))}
      </div>
      <button className="fs-dialog-btn fs-pick-confirm" disabled={!picked} onClick={() => setConfirmed(true)} data-testid="button-bouquet-confirm">
        {picked ? `Confirm ${picked.name} (demo)` : "Select a bouquet"}
      </button>
      <p className="fs-note">Preview only. Confirming does not place an order or take payment.</p>
    </>
  );
}
