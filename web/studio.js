import mermaid from "./mermaid.mjs";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  fontFamily: "Avenir Next, Segoe UI, sans-serif",
  themeVariables: {
    primaryColor: "#e8efff",
    primaryTextColor: "#17202a",
    primaryBorderColor: "#3467eb",
    lineColor: "#5f6b7a",
    secondaryColor: "#fff0ed",
    tertiaryColor: "#f6f8fb",
  },
});

const base = new URL(".", window.location.href);
const source = document.querySelector("#source");
const preview = document.querySelector("#preview");
const empty = document.querySelector("#empty");
const picker = document.querySelector("#diagram-picker");
const version = document.querySelector("#version");
const validation = document.querySelector("#validation");
const renderTime = document.querySelector("#render-time");
const saveState = document.querySelector("#save-state");
const saveButton = document.querySelector("#save");
const connection = document.querySelector("#connection");
const toast = document.querySelector("#toast");

let current;
let renderSequence = 0;
let renderTimer;
let toastTimer;

function endpoint(path) {
  return new URL(path.replace(/^\//, ""), base).toString();
}

async function request(path, options) {
  const response = await fetch(endpoint(path), options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
}

async function refreshList(selectedId) {
  const diagrams = await request("api/diagrams");
  picker.replaceChildren(...diagrams.map((item) => new Option(`${item.title} · v${item.version}`, item.id)));
  if (selectedId && diagrams.some((item) => item.id === selectedId)) picker.value = selectedId;
  picker.disabled = diagrams.length === 0;
  return diagrams;
}

async function load(id, preserveDraft = false) {
  if (!id) return;
  if (preserveDraft && current && source.value !== current.source) return;
  current = await request(`api/diagrams/${encodeURIComponent(id)}`);
  source.value = current.source;
  version.textContent = `v${current.version}`;
  document.title = `${current.title} · Mermaid Studio`;
  await refreshList(id);
  scheduleRender(0);
  saveState.textContent = "Ready";
}

async function render() {
  const code = source.value.trim();
  const sequence = ++renderSequence;
  if (!code) {
    preview.replaceChildren();
    empty.hidden = false;
    validation.textContent = "Waiting for source";
    validation.className = "validation";
    return;
  }
  const started = performance.now();
  try {
    await mermaid.parse(code);
    const { svg, bindFunctions } = await mermaid.render(`diagram-${sequence}`, code);
    if (sequence !== renderSequence) return;
    preview.innerHTML = svg;
    bindFunctions?.(preview);
    empty.hidden = true;
    validation.textContent = "Valid Mermaid";
    validation.className = "validation valid";
    renderTime.textContent = `${Math.round(performance.now() - started)} ms`;
  } catch (error) {
    if (sequence !== renderSequence) return;
    preview.replaceChildren();
    empty.hidden = false;
    empty.querySelector("strong").textContent = "Mermaid could not render this source.";
    empty.querySelector("span").textContent = String(error?.message || error).split("\n")[0];
    validation.textContent = "Syntax error";
    validation.className = "validation invalid";
    renderTime.textContent = `${Math.round(performance.now() - started)} ms`;
  }
}

function scheduleRender(delay = 250) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => void render(), delay);
}

async function save() {
  if (!current) return;
  saveButton.disabled = true;
  saveState.textContent = "Saving…";
  try {
    current = await request(`api/diagrams/${encodeURIComponent(current.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source.value, expectedVersion: current.version }),
    });
    version.textContent = `v${current.version}`;
    saveState.textContent = "Saved";
    await refreshList(current.id);
    notify(`Saved ${current.id} v${current.version}`);
  } catch (error) {
    saveState.textContent = "Save failed";
    notify(error.message);
    if (/Version conflict/.test(error.message)) await load(current.id);
  } finally {
    saveButton.disabled = false;
  }
}

source.addEventListener("input", () => {
  saveState.textContent = "Unsaved changes";
  scheduleRender();
});
source.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void save();
  }
});
saveButton.addEventListener("click", () => void save());
picker.addEventListener("change", () => {
  const url = new URL(window.location.href);
  url.searchParams.set("id", picker.value);
  history.replaceState({}, "", url);
  void load(picker.value);
});
document.querySelector("#fit").addEventListener("click", () => {
  const svg = preview.querySelector("svg");
  if (!svg) return;
  const available = document.querySelector("#preview-wrap").clientWidth - 56;
  const scale = Math.min(1, available / svg.getBoundingClientRect().width);
  preview.style.transform = `scale(${scale})`;
  notify(scale < 1 ? `Fit to ${Math.round(scale * 100)}%` : "Already fits");
});

const events = new EventSource(endpoint("events"));
events.onopen = () => {
  connection.classList.add("live");
  connection.lastChild.textContent = " Live";
};
events.onerror = () => {
  connection.classList.remove("live");
  connection.lastChild.textContent = " Reconnecting";
};
events.addEventListener("diagram", (event) => {
  const update = JSON.parse(event.data);
  if (current?.id === update.id && current.version !== update.version) void load(update.id, true);
  else void refreshList(current?.id);
});

const requested = new URL(window.location.href).searchParams.get("id");
const diagrams = await refreshList(requested);
const initial = requested || diagrams[0]?.id;
if (initial) await load(initial);
else {
  source.disabled = true;
  saveButton.disabled = true;
  empty.hidden = false;
  empty.querySelector("strong").textContent = "No diagrams in this project.";
  empty.querySelector("span").textContent = "Ask Pi to create one, then this workbench will update.";
}
