import mermaid from "./vendor/mermaid/mermaid.esm.min.mjs";

const STUDIO_LIGHT = {
  primaryColor: "#e8efff", primaryTextColor: "#17202a", primaryBorderColor: "#3467eb",
  lineColor: "#5f6b7a", secondaryColor: "#fff0ed", tertiaryColor: "#f6f8fb", background: "#fdfefe",
};
const STUDIO_DARK = {
  primaryColor: "#223152", primaryTextColor: "#e8edf4", primaryBorderColor: "#7da2ff",
  lineColor: "#98a5b5", secondaryColor: "#422a2c", tertiaryColor: "#18202a", background: "#121922",
};

const base = new URL(".", window.location.href);
const $ = (selector) => document.querySelector(selector);
const source = $("#source");
const preview = $("#preview");
const previewWrap = $("#preview-wrap");
const previewPane = $(".preview-pane");
const empty = $("#empty");
const picker = $("#diagram-picker");
const historyPicker = $("#history-picker");
const version = $("#version");
const qualityToggle = $("#quality-toggle");
const qualityPanel = $("#quality-panel");
const renderTime = $("#render-time");
const saveState = $("#save-state");
const saveButton = $("#save");
const connection = $("#connection");
const toast = $("#toast");
const uiTheme = $("#ui-theme");
const renderTheme = $("#render-theme");
const zoomLevel = $("#zoom-level");

let current;
let renderSequence = 0;
let renderTimer;
let toastTimer;
let scale = 1;
let panning;

function endpoint(path) { return new URL(path.replace(/^\//, ""), base).toString(); }

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

function resolvedUiTheme() {
  if (uiTheme.value !== "system") return uiTheme.value;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initializeMermaid() {
  const mode = resolvedUiTheme();
  const chosen = renderTheme.value || "studio";
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: chosen === "studio" ? "base" : chosen,
    fontFamily: "Avenir Next, Segoe UI, sans-serif",
    themeVariables: chosen === "studio" ? (mode === "dark" ? STUDIO_DARK : STUDIO_LIGHT) : undefined,
  });
}

function applyUiTheme() {
  document.documentElement.dataset.theme = resolvedUiTheme();
  localStorage.setItem("mermaid-studio-ui-theme", uiTheme.value);
  initializeMermaid();
  scheduleRender(0);
}

async function refreshList(selectedId) {
  const diagrams = await request("api/diagrams");
  picker.replaceChildren(...diagrams.map((item) => new Option(`${item.title} · v${item.version}`, item.id)));
  if (selectedId && diagrams.some((item) => item.id === selectedId)) picker.value = selectedId;
  picker.disabled = diagrams.length === 0;
  return diagrams;
}

function refreshHistory(selectedVersion) {
  const versions = [...(current?.versions || [])].reverse();
  historyPicker.replaceChildren(...versions.map((item) => new Option(`v${item.version} · ${item.actor}`, String(item.version))));
  historyPicker.value = String(selectedVersion || current?.version || "");
  historyPicker.disabled = versions.length < 2;
}

async function load(id, preserveDraft = false) {
  if (!id) return;
  if (preserveDraft && current && source.value !== current.source) return;
  current = await request(`api/diagrams/${encodeURIComponent(id)}`);
  source.value = current.source;
  version.textContent = `v${current.version}`;
  document.title = `${current.title} · Mermaid Studio`;
  await refreshList(id);
  refreshHistory(current.version);
  scheduleRender(0);
  saveState.textContent = "Ready";
}

function showQuality(warnings = []) {
  qualityPanel.replaceChildren();
  if (!warnings.length) {
    qualityToggle.textContent = "Valid Mermaid · quality clear";
    qualityToggle.className = "validation valid";
    qualityToggle.disabled = true;
    qualityPanel.hidden = true;
    return;
  }
  qualityToggle.textContent = `Valid Mermaid · ${warnings.length} quality suggestion${warnings.length === 1 ? "" : "s"}`;
  qualityToggle.className = "validation warning";
  qualityToggle.disabled = false;
  const list = document.createElement("ul");
  for (const warning of warnings) {
    const item = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = warning.code;
    item.append(code, ` · ${warning.message}`);
    list.append(item);
  }
  qualityPanel.append(list);
}

async function render() {
  const code = source.value.trim();
  const sequence = ++renderSequence;
  if (!code) {
    preview.replaceChildren(); empty.hidden = false; qualityPanel.hidden = true;
    qualityToggle.textContent = "Waiting for source"; qualityToggle.className = "validation"; qualityToggle.disabled = true;
    return;
  }
  const started = performance.now();
  try {
    initializeMermaid();
    await mermaid.parse(code);
    const [{ svg, bindFunctions }, quality] = await Promise.all([
      mermaid.render(`diagram-${sequence}`, code),
      request("api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: code }) }),
    ]);
    if (sequence !== renderSequence) return;
    preview.innerHTML = svg;
    bindFunctions?.(preview);
    empty.hidden = true;
    showQuality(quality.warnings);
    renderTime.textContent = `${Math.round(performance.now() - started)} ms`;
    applyScale();
  } catch (error) {
    if (sequence !== renderSequence) return;
    preview.replaceChildren(); empty.hidden = false; qualityPanel.hidden = true;
    empty.querySelector("strong").textContent = "Mermaid could not render this source.";
    empty.querySelector("span").textContent = String(error?.message || error).split("\n")[0];
    qualityToggle.textContent = "Syntax error"; qualityToggle.className = "validation invalid"; qualityToggle.disabled = true;
    renderTime.textContent = `${Math.round(performance.now() - started)} ms`;
  }
}

function scheduleRender(delay = 250) { clearTimeout(renderTimer); renderTimer = setTimeout(() => void render(), delay); }

async function save() {
  if (!current) return;
  saveButton.disabled = true; saveState.textContent = "Saving…";
  try {
    current = await request(`api/diagrams/${encodeURIComponent(current.id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source.value, expectedVersion: current.version }),
    });
    version.textContent = `v${current.version}`; saveState.textContent = "Saved";
    refreshHistory(current.version);
    await refreshList(current.id);
    notify(`Saved ${current.id} v${current.version}`);
  } catch (error) {
    saveState.textContent = "Save failed"; notify(error.message);
    if (/Version conflict/.test(error.message)) await load(current.id);
  } finally { saveButton.disabled = false; }
}

function applyScale() {
  scale = Math.max(0.2, Math.min(4, scale));
  preview.style.transform = `scale(${scale})`;
  zoomLevel.textContent = `${Math.round(scale * 100)}%`;
}

function setScale(next) { scale = next; applyScale(); }

function fit() {
  const svg = preview.querySelector("svg");
  if (!svg) return;
  preview.style.transform = "none";
  const rect = svg.getBoundingClientRect();
  const availableWidth = previewWrap.clientWidth - 64;
  const availableHeight = previewWrap.clientHeight - 64;
  setScale(Math.min(1, availableWidth / rect.width, availableHeight / rect.height));
  notify(`Fit to ${Math.round(scale * 100)}%`);
}

function resetView() { setScale(1); previewWrap.scrollTo({ left: 0, top: 0, behavior: "smooth" }); }

function fileName(extension) { return `${current?.id || "diagram"}.${extension}`; }
function blobDownload(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function serializedSvg() {
  const svg = preview.querySelector("svg");
  if (!svg) throw new Error("Render a valid diagram first.");
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

async function rasterBlob(type) {
  const svg = preview.querySelector("svg");
  if (!svg) throw new Error("Render a valid diagram first.");
  const markup = serializedSvg();
  const viewBox = svg.viewBox?.baseVal;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, viewBox?.width || rect.width / scale);
  const height = Math.max(1, viewBox?.height || rect.height / scale);
  const exportScale = Number($("#export-scale").value);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * exportScale); canvas.height = Math.ceil(height * exportScale);
  const ctx = canvas.getContext("2d");
  const transparent = $("#export-background").value === "transparent" && type === "image/png";
  if (!transparent) {
    ctx.fillStyle = resolvedUiTheme() === "dark" ? "#121922" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const image = new Image();
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not rasterize diagram.")), type, 0.94));
}

async function copyText(value, label) { await navigator.clipboard.writeText(value); notify(`${label} copied`); }

async function download() {
  try {
    const format = $("#export-format").value;
    if (format === "mmd") blobDownload(new Blob([source.value], { type: "text/plain;charset=utf-8" }), fileName("mmd"));
    else if (format === "svg") blobDownload(new Blob([serializedSvg()], { type: "image/svg+xml" }), fileName("svg"));
    else {
      const type = format === "jpg" ? "image/jpeg" : "image/png";
      blobDownload(await rasterBlob(type), fileName(format));
    }
    notify(`Downloaded ${format.toUpperCase()}`);
  } catch (error) { notify(error.message); }
}

source.addEventListener("input", () => { saveState.textContent = "Unsaved changes"; scheduleRender(); });
source.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
});
saveButton.addEventListener("click", () => void save());
$("#copy-source").addEventListener("click", () => void copyText(source.value, "Mermaid source"));
picker.addEventListener("change", () => {
  const url = new URL(window.location.href); url.searchParams.set("id", picker.value); history.replaceState({}, "", url); void load(picker.value);
});
historyPicker.addEventListener("change", () => {
  const item = current?.versions.find((entry) => entry.version === Number(historyPicker.value));
  if (!item) return;
  source.value = item.source;
  saveState.textContent = item.version === current.version ? "Ready" : `Viewing v${item.version} · save to restore`;
  scheduleRender(0);
});
qualityToggle.addEventListener("click", () => { qualityPanel.hidden = !qualityPanel.hidden; });
$("#fit").addEventListener("click", fit);
$("#reset").addEventListener("click", resetView);
$("#zoom-in").addEventListener("click", () => setScale(scale + 0.1));
$("#zoom-out").addEventListener("click", () => setScale(scale - 0.1));
$("#fullscreen").addEventListener("click", () => void (document.fullscreenElement ? document.exitFullscreen() : previewPane.requestFullscreen()));
$("#download").addEventListener("click", () => void download());
$("#copy-svg").addEventListener("click", () => { try { void copyText(serializedSvg(), "SVG"); } catch (error) { notify(error.message); } });
$("#copy-png").addEventListener("click", async () => {
  try { const blob = await rasterBlob("image/png"); await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); notify("PNG copied"); }
  catch (error) { notify(error.message); }
});

uiTheme.value = localStorage.getItem("mermaid-studio-ui-theme") || "system";
renderTheme.value = localStorage.getItem("mermaid-studio-render-theme") || "studio";
uiTheme.addEventListener("change", applyUiTheme);
renderTheme.addEventListener("change", () => { localStorage.setItem("mermaid-studio-render-theme", renderTheme.value); initializeMermaid(); scheduleRender(0); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (uiTheme.value === "system") applyUiTheme(); });
applyUiTheme();

previewWrap.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  panning = { x: event.clientX, y: event.clientY, left: previewWrap.scrollLeft, top: previewWrap.scrollTop };
  previewWrap.classList.add("dragging"); previewWrap.setPointerCapture(event.pointerId);
});
previewWrap.addEventListener("pointermove", (event) => {
  if (!panning) return;
  previewWrap.scrollLeft = panning.left - (event.clientX - panning.x);
  previewWrap.scrollTop = panning.top - (event.clientY - panning.y);
});
previewWrap.addEventListener("pointerup", () => { panning = undefined; previewWrap.classList.remove("dragging"); });

const events = new EventSource(endpoint("events"));
events.onopen = () => { connection.classList.add("live"); connection.lastChild.textContent = " Live"; };
events.onerror = () => { connection.classList.remove("live"); connection.lastChild.textContent = " Reconnecting"; };
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
  source.disabled = true; saveButton.disabled = true; empty.hidden = false;
  empty.querySelector("strong").textContent = "No diagrams in this project.";
  empty.querySelector("span").textContent = "Ask Pi to create one, then this workbench will update.";
}
