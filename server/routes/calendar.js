const { Router } = require("express");
const {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getEventsInRange,
  addEvent,
  updateEvent,
  deleteEvent,
} = require("../lib/calendarStore");

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function validateEventInput(body, categories) {
  const { title, date, allDay, startTime, endTime, categoryId, notes } = body || {};
  if (!title || !String(title).trim()) return "Naslov je obavezan.";
  if (!DATE_RE.test(date || "")) return "Datum mora biti u formatu GGGG-MM-DD.";
  if (!categories.some((c) => c.id === categoryId)) return "Nepoznat kalendar.";
  if (!allDay) {
    if (!TIME_RE.test(startTime || "") || !TIME_RE.test(endTime || "")) {
      return "Vreme početka i završetka je obavezno kad događaj nije celodnevni.";
    }
    if (startTime >= endTime) return "Vreme završetka mora biti posle vremena početka.";
  }
  if (notes !== undefined && typeof notes !== "string") return "Napomena mora biti tekst.";
  return null;
}

router.get("/calendar/categories", (req, res) => {
  res.json({ categories: getCategories(req.company) });
});

router.post("/calendar/categories", (req, res) => {
  const { name, color } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Naziv kalendara je obavezan." });
  }
  if (!color || typeof color !== "string") {
    return res.status(400).json({ error: "Boja kalendara je obavezna." });
  }
  const category = addCategory(req.company, { name: name.trim(), color });
  res.json({ category });
});

router.patch("/calendar/categories/:id", (req, res) => {
  const categories = getCategories(req.company);
  if (!categories.some((c) => c.id === req.params.id)) {
    return res.status(404).json({ error: "Kalendar nije pronađen." });
  }
  const { name, color } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (color !== undefined) patch.color = color;
  const category = updateCategory(req.company, req.params.id, patch);
  res.json({ category });
});

router.delete("/calendar/categories/:id", (req, res) => {
  const categories = getCategories(req.company);
  if (!categories.some((c) => c.id === req.params.id)) {
    return res.status(404).json({ error: "Kalendar nije pronađen." });
  }
  const { error } = deleteCategory(req.company, req.params.id);
  if (error === "has-events") {
    return res
      .status(400)
      .json({ error: "Ovaj kalendar ima događaje — prvo ih obriši ili premesti." });
  }
  res.json({ ok: true });
});

router.get("/calendar/events", (req, res) => {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "")) {
    return res.status(400).json({ error: "from i to su obavezni, u formatu GGGG-MM-DD." });
  }
  res.json({ events: getEventsInRange(req.company, from, to) });
});

router.post("/calendar/events", (req, res) => {
  const categories = getCategories(req.company);
  const error = validateEventInput(req.body, categories);
  if (error) return res.status(400).json({ error });

  const { title, date, allDay, startTime, endTime, categoryId, notes } = req.body;
  const event = addEvent(req.company, {
    title: title.trim(),
    date,
    allDay: Boolean(allDay),
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    categoryId,
    notes: notes ? notes.trim() : "",
  });
  res.json({ event });
});

router.patch("/calendar/events/:id", (req, res) => {
  const categories = getCategories(req.company);
  const merged = { ...req.body };
  const error = validateEventInput(merged, categories);
  if (error) return res.status(400).json({ error });

  const { title, date, allDay, startTime, endTime, categoryId, notes } = merged;
  const event = updateEvent(req.company, req.params.id, {
    title: title.trim(),
    date,
    allDay: Boolean(allDay),
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    categoryId,
    notes: notes ? notes.trim() : "",
  });
  if (!event) return res.status(404).json({ error: "Događaj nije pronađen." });
  res.json({ event });
});

router.delete("/calendar/events/:id", (req, res) => {
  deleteEvent(req.company, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
