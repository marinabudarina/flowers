export function BeadCardBack() {
  return (
    <>
      <div className="bead-metal" aria-hidden="true" />
      <img
        className="bead-back-artwork"
        src={`${import.meta.env.BASE_URL}argon-beaded-four.webp`}
        alt=""
        draggable={false}
        data-testid="img-back-artwork"
      />
      <div className="bead-back-content">
        <span className="bead-back-tags bead-tags" data-testid="text-back-tags"><b>VISUAL</b><b>IDENTITY</b></span>
        <svg className="bead-back-mark" width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
          <circle cx="10" cy="10" r="8" /><circle cx="10" cy="10" r="4.5" /><path d="M27 5l8 8M35 7v6h-6" />
        </svg>
        <h2 className="bead-back-title" data-testid="text-back-title">Argon<br />Gemini</h2>
        <div className="bead-back-date bead-date" data-testid="text-back-date">
          <span>20</span><i /><span>09</span><i /><span>2022</span>
        </div>
      </div>
      <div className="bead-sheen" aria-hidden="true" />
    </>
  );
}
