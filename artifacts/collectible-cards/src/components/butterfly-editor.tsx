import { MAX_BUTTERFLIES, type ButterflySettings } from "@/lib/butterfly-settings";

const PRESETS = ["#e8772e", "#f2c14e", "#d94f70", "#5b8fd9", "#7cae6a", "#f5f4ef", "#2b2a27"];

type Props = {
  settings: ButterflySettings;
  onChange: (next: ButterflySettings) => void;
};

export function ButterflyEditor({ settings, onChange }: Props) {
  const { items } = settings;
  const full = items.length >= MAX_BUTTERFLIES;
  const setColor = (id: string, color: string) =>
    onChange({ ...settings, items: items.map((b) => (b.id === id ? { ...b, color } : b)) });
  const remove = (id: string) => onChange({ ...settings, items: items.filter((b) => b.id !== id) });
  const add = () => {
    if (full) return;
    onChange({ ...settings, items: [...items, { id: crypto.randomUUID(), color: PRESETS[0] }] });
  };

  return (
    <section className="fs-bf" aria-labelledby="fs-bf-h" data-testid="panel-butterflies">
      <div className="fs-bf-head">
        <h3 id="fs-bf-h">Butterflies</h3>
        <span className="fs-bf-count" data-testid="text-butterfly-count">{items.length} / {MAX_BUTTERFLIES}</span>
      </div>
      {items.length === 0 ? (
        <p className="fs-note fs-bf-empty" data-testid="text-butterflies-empty">No butterflies on the card. Add one to bring a little movement back.</p>
      ) : (
        <ul className="fs-bf-list">
          {items.map((b, n) => (
            <li key={b.id} data-testid={`row-butterfly-${b.id}`}>
              <label className="fs-bf-swatch" style={{ background: b.color }}>
                <span className="sr-only">Butterfly {n + 1} colour</span>
                <input type="color" value={b.color} onChange={(e) => setColor(b.id, e.target.value)} data-testid={`input-butterfly-color-${b.id}`} />
              </label>
              <div className="fs-bf-presets" role="group" aria-label={`Preset colours for butterfly ${n + 1}`}>
                {PRESETS.map((c) => (
                  <button key={c} type="button" style={{ background: c }} aria-label={`Set butterfly ${n + 1} to ${c}`} aria-pressed={b.color.toLowerCase() === c} onClick={() => setColor(b.id, c)} data-testid={`button-butterfly-preset-${b.id}-${c.slice(1)}`} />
                ))}
              </div>
              <button type="button" className="fs-bf-remove" onClick={() => remove(b.id)} aria-label={`Remove butterfly ${n + 1}`} data-testid={`button-remove-butterfly-${b.id}`}>remove</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="fs-bf-add" onClick={add} disabled={full} data-testid="button-add-butterfly">
        {full ? `Limit of ${MAX_BUTTERFLIES} reached` : "+ Add butterfly"}
      </button>
    </section>
  );
}
