function pageNumbers(current, total) {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const numbers = pageNumbers(page, totalPages);

  return (
    <nav className="pagination">
      <button
        type="button"
        className="pagination-btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Prethodna
      </button>

      <div className="pagination-numbers">
        {numbers.map((n, i) => {
          const prev = numbers[i - 1];
          const showEllipsis = prev !== undefined && n - prev > 1;
          return (
            <span key={n} style={{ display: "contents" }}>
              {showEllipsis && <span className="pagination-ellipsis">…</span>}
              <button
                type="button"
                className={"pagination-number" + (n === page ? " active" : "")}
                onClick={() => onChange(n)}
              >
                {n}
              </button>
            </span>
          );
        })}
      </div>

      <button
        type="button"
        className="pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Sledeća
      </button>
    </nav>
  );
}
