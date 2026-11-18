// On phones a wide table (Meta campaigns: 18 columns) can't fit, and just
// stacking its cells loses the column headers — you see "264", "2.399 EUR"
// with no idea which metric that is. This labels every <td> with its
// column's header text (data-label) and marks the table .rt-stack, so the
// mobile CSS in index.css can render each row as a card of
// "Header ........ value" lines. Done once, globally, with a
// MutationObserver so every table — including premium modules and tables
// rendered later — gets it without per-page markup changes.
//
// Opt out per table with className="no-stack". A <td> that already has its
// own data-label keeps it.

function headerLabels(table) {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return null;
  const labels = [];
  for (const th of headRow.cells) {
    const text = (th.getAttribute("data-label") ?? th.textContent ?? "")
      .replace(/[▲▼↑↓⇅]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    for (let i = 0; i < (th.colSpan || 1); i++) labels.push(text);
  }
  return labels;
}

function labelTable(table) {
  if (table.classList.contains("no-stack")) return;
  const labels = headerLabels(table);
  if (!labels || labels.length === 0) return;
  table.classList.add("rt-stack");

  const sections = [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])];
  for (const section of sections) {
    for (const row of section.rows) {
      let col = 0;
      let titled = false;
      for (const cell of row.cells) {
        const span = cell.colSpan || 1;
        if (cell.tagName === "TD") {
          if (span === 1) {
            const label = labels[col] || "";
            if (!cell.hasAttribute("data-label") && label) {
              cell.setAttribute("data-label", label);
            }
            const finalLabel = cell.getAttribute("data-label");
            // First labelled cell (campaign / product / name) becomes the
            // card's title instead of a "label: value" line.
            if (!titled && finalLabel) {
              titled = true;
              if (!cell.hasAttribute("data-stack-title")) cell.setAttribute("data-stack-title", "");
            }
          } else {
            cell.setAttribute("data-stack-full", "");
          }
        }
        col += span;
      }
    }
  }
}

let scheduled = false;
function labelAll() {
  scheduled = false;
  document.querySelectorAll("table").forEach(labelTable);
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  // setTimeout, not requestAnimationFrame: rAF is paused in background
  // tabs, which would leave tables unlabeled until the tab is focused.
  setTimeout(labelAll, 30);
}

export function installResponsiveTables() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;
  // Only childList/characterData: our own setAttribute calls don't
  // re-trigger the observer.
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  schedule();
}
