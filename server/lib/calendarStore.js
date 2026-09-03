const crypto = require("crypto");
const { createJsonFile } = require("./jsonFile");

const DEFAULT_CATEGORIES = [{ id: "default", name: "Moji događaji", color: "purple" }];

// Keyed by company (see lib/auth.js) — every account used to read/write
// the exact same calendar regardless of which company it belongs to.
const file = createJsonFile("calendar.json", {});
let byCompany = file.read();

function stateFor(company) {
  return byCompany[company] || { categories: DEFAULT_CATEGORIES, events: [] };
}

function persist(company, state) {
  byCompany = { ...byCompany, [company]: state };
  file.write(byCompany);
}

function getCategories(company) {
  return stateFor(company).categories;
}

function addCategory(company, { name, color }) {
  const category = { id: crypto.randomUUID(), name, color };
  const state = stateFor(company);
  persist(company, { ...state, categories: [...state.categories, category] });
  return category;
}

function updateCategory(company, id, patch) {
  const state = stateFor(company);
  const categories = state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
  persist(company, { ...state, categories });
  return categories.find((c) => c.id === id) || null;
}

// Refuses to delete a category that still has events attached — callers
// should have the user move or delete those events first rather than
// silently orphaning them.
function deleteCategory(company, id) {
  const state = stateFor(company);
  const hasEvents = state.events.some((e) => e.categoryId === id);
  if (hasEvents) return { error: "has-events" };
  persist(company, { ...state, categories: state.categories.filter((c) => c.id !== id) });
  return { error: null };
}

function getEventsInRange(company, from, to) {
  return stateFor(company).events.filter((e) => e.date >= from && e.date <= to);
}

function addEvent(company, input) {
  const event = { id: crypto.randomUUID(), ...input };
  const state = stateFor(company);
  persist(company, { ...state, events: [...state.events, event] });
  return event;
}

function updateEvent(company, id, patch) {
  const state = stateFor(company);
  const events = state.events.map((e) => (e.id === id ? { ...e, ...patch } : e));
  persist(company, { ...state, events });
  return events.find((e) => e.id === id) || null;
}

function deleteEvent(company, id) {
  const state = stateFor(company);
  persist(company, { ...state, events: state.events.filter((e) => e.id !== id) });
}

module.exports = {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getEventsInRange,
  addEvent,
  updateEvent,
  deleteEvent,
};
