const crypto = require("crypto");
const { createJsonFile } = require("./jsonFile");

const DEFAULT_STATE = {
  categories: [
    { id: "default", name: "Moji događaji", color: "purple" },
  ],
  events: [],
};

const file = createJsonFile("calendar.json", DEFAULT_STATE);
let state = { ...DEFAULT_STATE, ...file.read() };

function persist() {
  file.write(state);
}

function getCategories() {
  return state.categories;
}

function addCategory({ name, color }) {
  const category = { id: crypto.randomUUID(), name, color };
  state = { ...state, categories: [...state.categories, category] };
  persist();
  return category;
}

function updateCategory(id, patch) {
  state = {
    ...state,
    categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
  persist();
  return state.categories.find((c) => c.id === id) || null;
}

// Refuses to delete a category that still has events attached — callers
// should have the user move or delete those events first rather than
// silently orphaning them.
function deleteCategory(id) {
  const hasEvents = state.events.some((e) => e.categoryId === id);
  if (hasEvents) return { error: "has-events" };
  state = { ...state, categories: state.categories.filter((c) => c.id !== id) };
  persist();
  return { error: null };
}

function getEventsInRange(from, to) {
  return state.events.filter((e) => e.date >= from && e.date <= to);
}

function addEvent(input) {
  const event = { id: crypto.randomUUID(), ...input };
  state = { ...state, events: [...state.events, event] };
  persist();
  return event;
}

function updateEvent(id, patch) {
  state = {
    ...state,
    events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
  persist();
  return state.events.find((e) => e.id === id) || null;
}

function deleteEvent(id) {
  state = { ...state, events: state.events.filter((e) => e.id !== id) };
  persist();
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
