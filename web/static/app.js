// LaTeX Studio (100% Offline-First PWA + MathJax 3)
import { SYMBOL_CATEGORIES, SYMBOLS, TEMPLATES } from "./catalog.js?v=6";

const PUBLIC_SITE_URL = "https://latex.twingophaseone.uk";

const THEME_KEY = "latex_studio_theme";
const PREFS_KEY = "latex_studio_prefs";
const DRAFT_KEY = "latex_studio_draft";
const SAVED_FALLBACK_KEY = "latex_studio_saved_equations";
const RECENTS_KEY = "latex_studio_recent_symbols";
const SPLIT_KEY = "latex_studio_split_pct";

const ENV_COMPLETIONS = [
  { id: "env-aligned", label: "aligned", latex: "\\begin{aligned}\n  a &= b \\\\\n  &= c\n\\end{aligned}", cursorOffset: 0, name: "Bloc aligné" },
  { id: "env-cases", label: "cases", latex: "\\begin{cases}\n  x & \\text{si } x \\ge 0 \\\\\n  -x & \\text{sinon}\n\\end{cases}", cursorOffset: 0, name: "Fonction par morceaux" },
  { id: "env-pmatrix", label: "pmatrix", latex: "\\begin{pmatrix}\n  a & b \\\\\n  c & d\n\\end{pmatrix}", cursorOffset: 0, name: "Matrice parenthèses" },
  { id: "env-bmatrix", label: "bmatrix", latex: "\\begin{bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}", cursorOffset: 0, name: "Matrice crochets" },
  { id: "env-gather", label: "gather", latex: "\\begin{gather}\n  \n\\end{gather}", cursorOffset: -13, name: "Équations centrées" },
];

const DEFAULT_PREFS = {
  fontSize: 28,
  displayLines: true,
  displayMode: true,
  previewBg: "auto",
  exportScale: 3,
  exportPadding: 20,
  exportBg: "transparent",
  exportCustomBg: "#ffffff",
  exportInkOverride: "auto",
};

const PAIRS = { "{": "}", "[": "]", "(": ")", "$": "$" };

const MATRIX_TYPES = [
  { id: "pmatrix", label: "( … )", hint: "pmatrix" },
  { id: "bmatrix", label: "[ … ]", hint: "bmatrix" },
  { id: "Bmatrix", label: "{ … }", hint: "Bmatrix" },
  { id: "vmatrix", label: "| … |", hint: "Déterminant" },
  { id: "Vmatrix", label: "‖ … ‖", hint: "Vmatrix" },
  { id: "matrix", label: "Sans bord", hint: "matrix" },
  { id: "cases", label: "{ cas", hint: "Système" },
  { id: "aligned", label: "Aligné", hint: "aligned" },
];

const TEMPLATE_CATEGORIES = ["Tous", "Classiques", "Analyse", "Algèbre", "Physique", "Chimie"];

const state = {
  theme: loadTheme(),
  prefs: loadPrefs(),
  latex: loadInitialDraft(),
  categories: [],
  symbols: [],
  templates: [],
  saved: [],
  activeTab: "frequent",
  searchQuery: "",
  ribbonCollapsed: false,
  layoutMode: "split",
  mathjaxReady: false,
  history: [],
  historyIndex: -1,
  acCandidates: [],
  acStartPos: 0,
  acIndex: 0,
  lastSvgElement: null,
  matrix: {
    env: "pmatrix",
    rows: 3,
    cols: 3,
    cells: Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 8 }, (_, c) => `a_{${r + 1}${c + 1}}`)
    ),
  },
  templateCat: "Tous",
  recentIds: loadRecents(),
  splitPct: loadSplitPct(),
};

function loadRecents() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function loadSplitPct() {
  try {
    const val = Number(localStorage.getItem(SPLIT_KEY));
    return val >= 25 && val <= 75 ? val : 50;
  } catch {
    return 50;
  }
}

// DOM References
const $ = (id) => document.getElementById(id);
const textarea = $("latex-editor-textarea");
const highlightEl = $("editor-highlight");
const gutterEl = $("editor-gutter");
const acPopup = $("autocomplete-popup");

function loadTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {}
  return "light";
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
  } catch {}
}

function loadInitialDraft() {
  try {
    const hash = window.location.hash;
    if (hash.startsWith("#tex=")) {
      const decoded = decodeLatexFromHash(hash.slice(5));
      if (decoded !== null) return decoded;
    }
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored !== null) return stored;
  } catch {}
  return "\\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi} \\\\\n\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}";
}

function encodeLatexFromString(latex) {
  const bytes = new TextEncoder().encode(latex);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeLatexFromHash(hashVal) {
  try {
    const b64 = hashVal.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  $("icon-moon").classList.toggle("hidden", theme === "dark");
  $("icon-sun").classList.toggle("hidden", theme !== "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

function showToast(text, variant = "success") {
  const container = $("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${variant}`;
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ==================== MathJax Rendering ====================
async function waitForMathJax(timeoutMs = 15000) {
  if (window.MathJax?.tex2svg) return true;
  if (window.MathJax?.startup?.promise) {
    try {
      await Promise.race([
        window.MathJax.startup.promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
      ]);
      return Boolean(window.MathJax?.tex2svg);
    } catch {
      return Boolean(window.MathJax?.tex2svg);
    }
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.MathJax?.tex2svg) return true;
    await new Promise((r) => setTimeout(r, 80));
  }
  return Boolean(window.MathJax?.tex2svg);
}

function renderLatexToSvg(rawLatex, { displayLines, displayMode }) {
  const trimmed = rawLatex.trim();
  if (!trimmed) return { svgElement: null, svgHtml: "", error: null };
  if (!window.MathJax?.tex2svg) {
    return { svgElement: null, svgHtml: "", error: "MathJax est en cours de chargement..." };
  }

  let cleaned = trimmed;
  if (cleaned.startsWith("$$") && cleaned.endsWith("$$") && cleaned.length > 4) {
    cleaned = cleaned.slice(2, -2).trim();
  } else if (cleaned.startsWith("\\[") && cleaned.endsWith("\\]") && cleaned.length > 4) {
    cleaned = cleaned.slice(2, -2).trim();
  }

  const input =
    displayLines && displayMode ? `\\displaystyle{\\displaylines{${cleaned}}}` : cleaned;

  try {
    const node = window.MathJax.tex2svg(input, { display: displayMode });
    const svg = node.querySelector("svg");
    if (!svg) return { svgElement: null, svgHtml: "", error: "Rendu SVG impossible." };
    const merror = svg.querySelector('[data-mml-node="merror"]');
    if (merror) {
      return {
        svgElement: svg,
        svgHtml: svg.outerHTML,
        error: merror.getAttribute("title") || merror.textContent || "Erreur de syntaxe LaTeX",
      };
    }
    return { svgElement: svg, svgHtml: svg.outerHTML, error: null };
  } catch (err) {
    return { svgElement: null, svgHtml: "", error: err.message || "Erreur MathJax" };
  }
}

function updatePreview() {
  const trimmed = state.latex.trim();
  const emptyEl = $("preview-empty");
  const outEl = $("preview-output");
  const errEl = $("preview-error");
  const printEl = $("print-only-canvas");

  if (!trimmed) {
    state.lastSvgElement = null;
    emptyEl.classList.remove("hidden");
    outEl.innerHTML = "";
    errEl.classList.add("hidden");
    printEl.innerHTML = "";
    return;
  }

  emptyEl.classList.add("hidden");
  if (!state.mathjaxReady) return;

  const res = renderLatexToSvg(state.latex, {
    displayLines: state.prefs.displayLines,
    displayMode: state.prefs.displayMode,
  });

  if (res.error) {
    if (outEl.innerHTML.trim()) {
      outEl.classList.add("stale");
    } else {
      outEl.classList.remove("stale");
    }
    errEl.textContent = `Syntaxe LaTeX : ${res.error}`;
    errEl.classList.remove("hidden");
    return;
  }

  outEl.classList.remove("stale");
  state.lastSvgElement = res.svgElement;
  outEl.style.fontSize = `${state.prefs.fontSize}px`;
  outEl.innerHTML = res.svgHtml;
  printEl.innerHTML = `<div class="mathjax-output" style="font-size:${state.prefs.fontSize}px">${res.svgHtml}</div>`;
  errEl.classList.add("hidden");
}

// ==================== Export Helpers ====================
function resolveExportBgColor() {
  switch (state.prefs.exportBg) {
    case "transparent":
      return null;
    case "white":
      return "#ffffff";
    case "dark":
      return "#09090b";
    case "custom":
      return state.prefs.exportCustomBg || "#ffffff";
  }
}

function resolveInkColor() {
  if (state.prefs.exportInkOverride === "black") return "#0f172a";
  if (state.prefs.exportInkOverride === "white") return "#f8fafc";
  if (state.prefs.exportBg === "dark") return "#f8fafc";
  if (state.prefs.exportBg === "white") return "#0f172a";
  return state.theme === "dark" ? "#f8fafc" : "#0f172a";
}

function prepareExportSvg() {
  if (!state.lastSvgElement) throw new Error("Aucune équation rendue à exporter.");
  const clone = state.lastSvgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const fontSizePx = state.prefs.fontSize;
  const exPx = fontSizePx * 0.5;
  const parseEx = (val) => {
    const num = parseFloat(val);
    if (Number.isNaN(num)) return 100;
    return val.endsWith("ex") ? num * exPx : val.endsWith("em") ? num * fontSizePx : num;
  };

  const innerW = Math.max(16, Math.round(parseEx(clone.getAttribute("width") || "10ex")));
  const innerH = Math.max(16, Math.round(parseEx(clone.getAttribute("height") || "4ex")));
  const pad = Math.max(0, state.prefs.exportPadding);

  const vbParts = (clone.getAttribute("viewBox") || "0 -1000 1000 1000").split(/\s+/).map(Number);
  const [vbX, vbY, vbW, vbH] = vbParts.length === 4 ? vbParts : [0, -1000, 1000, 1000];

  const padUX = pad * (vbW / innerW);
  const padUY = pad * (vbH / innerH);
  const newVbX = vbX - padUX;
  const newVbY = vbY - padUY;
  const newVbW = vbW + padUX * 2;
  const newVbH = vbH + padUY * 2;
  const totalW = innerW + pad * 2;
  const totalH = innerH + pad * 2;

  const ink = resolveInkColor();
  clone.setAttribute("viewBox", `${newVbX} ${newVbY} ${newVbW} ${newVbH}`);
  clone.setAttribute("width", `${totalW}px`);
  clone.setAttribute("height", `${totalH}px`);
  clone.style.color = ink;
  clone.removeAttribute("focusable");
  clone.removeAttribute("role");

  const serialized = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, ink);
  const bg = resolveExportBgColor();
  if (!bg) return { svgString: serialized, width: totalW, height: totalH };

  const rect = `<rect x="${newVbX}" y="${newVbY}" width="${newVbW}" height="${newVbH}" fill="${bg}"/>`;
  return {
    svgString: serialized.replace(/(<svg[^>]*>)/, `$1${rect}`),
    width: totalW,
    height: totalH,
  };
}

async function renderSvgToPngBlob(svgString, width, height, scale) {
  const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Erreur conversion SVG vers PNG"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encodage PNG échoué"))), "image/png", 1.0)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function exportSvg() {
  try {
    const { svgString } = prepareExportSvg();
    const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "equation.svg";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Fichier SVG téléchargé");
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function exportPng() {
  try {
    const { svgString, width, height } = prepareExportSvg();
    const blob = await renderSvgToPngBlob(svgString, width, height, state.prefs.exportScale);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "equation.png";
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Image PNG (${state.prefs.exportScale}×) téléchargée`);
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function copyPng() {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      throw new Error("Presse-papiers image non supporté.");
    }
    const { svgString, width, height } = prepareExportSvg();
    const blob = await renderSvgToPngBlob(svgString, width, height, state.prefs.exportScale);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast("Image PNG copiée dans le presse-papiers");
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function copySvg() {
  try {
    const { svgString } = prepareExportSvg();
    await navigator.clipboard.writeText(svgString);
    showToast("Code SVG copié dans le presse-papiers");
  } catch (e) {
    showToast(e.message, "error");
  }
}

function exportTex() {
  const trimmed = state.latex.trim();
  if (!trimmed) return;
  const content = `\\[\n${trimmed}\n\\]\n`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "equation.tex";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Fichier equation.tex téléchargé");
}

function setFontSize(px) {
  const clamped = Math.max(14, Math.min(64, Math.round(px)));
  state.prefs.fontSize = clamped;
  $("preview-font-size").value = String(clamped);
  $("preview-font-size-val").textContent = `${clamped}px`;
  savePrefs();
  updatePreview();
}

// ==================== Editor & Syntax Highlighting ====================
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightLine(line) {
  const re = /(%.*$)|(\\begin\{[^}]+\}|\\end\{[^}]+\})|(\\[a-zA-Z@]+|\\.)|([{}])|([[\]])|([=+\-*/^_&|<>!])|(\b\d+(?:\.\d+)?\b)/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out += escapeHtml(line.slice(last, m.index));
    const [full, comment, env, cmd, brace, bracket, op, num] = m;
    const cls = comment
      ? "tok-comment"
      : env
        ? "tok-env"
        : cmd
          ? "tok-command"
          : brace
            ? "tok-brace"
            : bracket
              ? "tok-bracket"
              : op
                ? "tok-operator"
                : num
                  ? "tok-number"
                  : "";
    out += `<span class="${cls}">${escapeHtml(full)}</span>`;
    last = m.index + full.length;
  }
  if (last < line.length) out += escapeHtml(line.slice(last));
  return out || "&#8203;";
}

function renderEditorDecorations() {
  const lines = state.latex.split("\n");
  highlightEl.innerHTML = lines.map((l) => `<div>${highlightLine(l)}</div>`).join("");
  gutterEl.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join("");
  const lc = Math.max(1, lines.length);
  const cc = state.latex.length;
  $("editor-stats").textContent = `${lc} ligne${lc > 1 ? "s" : ""} · ${cc} caractère${cc > 1 ? "s" : ""}`;
}

function pushHistory(val) {
  if (state.history[state.historyIndex] === val) return;
  state.history = state.history.slice(0, state.historyIndex + 1).concat(val).slice(-80);
  state.historyIndex = state.history.length - 1;
  $("btn-undo").disabled = state.historyIndex <= 0;
  $("btn-redo").disabled = state.historyIndex >= state.history.length - 1;
}

function setLatexValue(nextVal, { recordHistory = true } = {}) {
  state.latex = nextVal;
  if (textarea.value !== nextVal) textarea.value = nextVal;
  try {
    localStorage.setItem(DRAFT_KEY, nextVal);
  } catch {}
  if (recordHistory) pushHistory(nextVal);
  renderEditorDecorations();
  updatePreview();
}

function insertSnippet(snippet, cursorOffset = 0) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = state.latex.slice(start, end);
  let finalSnippet = snippet;
  let targetCursor = start + snippet.length + cursorOffset;

  if (selected && snippet.includes("{}")) {
    const idx = snippet.indexOf("{}");
    finalSnippet = snippet.slice(0, idx + 1) + selected + snippet.slice(idx + 1);
    targetCursor = start + idx + 1 + selected.length + 1;
  } else if (selected && snippet.includes("  ")) {
    const idx = snippet.indexOf("  ");
    finalSnippet = snippet.slice(0, idx + 1) + selected + snippet.slice(idx + 1);
    targetCursor = start + finalSnippet.length;
  }

  const nextVal = state.latex.slice(0, start) + finalSnippet + state.latex.slice(end);
  setLatexValue(nextVal);
  hideAutocomplete();
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(targetCursor, targetCursor);
  });
}

function updateAutocomplete() {
  const caret = textarea.selectionStart;
  const before = state.latex.slice(0, caret);
  const match = before.match(/(\\[a-zA-Z]+)$/);
  if (!match || match[1].length < 2) {
    hideAutocomplete();
    return;
  }
  const q = match[1].toLowerCase();
  const seen = new Set();
  const cands = [];
  for (const s of [...ENV_COMPLETIONS, ...state.symbols]) {
    const cmd = s.latex.trim();
    if (!cmd.startsWith("\\") || seen.has(cmd)) continue;
    if (cmd.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q.slice(1))) {
      seen.add(cmd);
      cands.push(s);
      if (cands.length >= 8) break;
    }
  }
  if (cands.length === 0) {
    hideAutocomplete();
    return;
  }
  state.acCandidates = cands;
  state.acStartPos = caret - match[1].length;
  state.acIndex = 0;
  renderAutocomplete();
}

function hideAutocomplete() {
  state.acCandidates = [];
  acPopup.classList.add("hidden");
}

function renderAutocomplete() {
  acPopup.classList.remove("hidden");
  acPopup.innerHTML =
    `<div class="ac-header"><span>Autocomplétion</span><span>Tab / Entrée</span></div>` +
    state.acCandidates
      .map(
        (item, idx) => `
      <button type="button" class="ac-item ${idx === state.acIndex ? "active" : ""}" data-ac-idx="${idx}">
        <span>${escapeHtml(item.label)} <code>${escapeHtml(item.latex.trim())}</code></span>
        <span class="muted">${escapeHtml(item.name)}</span>
      </button>`
      )
      .join("");
}

function acceptAutocomplete(item) {
  const caret = textarea.selectionStart;
  const nextVal = state.latex.slice(0, state.acStartPos) + item.latex + state.latex.slice(caret);
  const cursorPos = state.acStartPos + item.latex.length + (item.cursorOffset || 0);
  setLatexValue(nextVal);
  hideAutocomplete();
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursorPos, cursorPos);
  });
}

// ==================== Symbol Ribbon ====================
function renderSymbolTabs() {
  $("symbol-tabs").innerHTML = state.categories
    .map(
      (cat) => `
      <button type="button" role="tab" class="tab-btn ${!state.searchQuery && state.activeTab === cat.id ? "active" : ""}" data-tab="${cat.id}">
        ${escapeHtml(cat.label)}
      </button>`
    )
    .join("");
}

function recordRecentSymbol(symId) {
  state.recentIds = [symId, ...state.recentIds.filter((id) => id !== symId)].slice(0, 10);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(state.recentIds));
  } catch {}
  renderRecentSymbols();
}

function renderRecentSymbols() {
  const bar = $("recent-symbols-bar");
  const listEl = $("recent-symbols-list");
  if (!bar || !listEl) return;
  const items = state.recentIds
    .map((id) => state.symbols.find((s) => s.id === id))
    .filter(Boolean);
  if (items.length === 0 || state.searchQuery.trim()) {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");
  listEl.innerHTML = items
    .map(
      (s) => `
      <button type="button" class="sym-btn sym-btn-sm" data-sym-id="${s.id}" aria-label="${escapeHtml(s.name)} (${escapeHtml(s.latex)})" title="${escapeHtml(s.name)} — ${escapeHtml(s.latex)}">
        ${s.swatch ? `<span class="sym-swatch" style="background:${s.swatch}"></span>` : ""}
        <span class="${s.swatch ? "sym-label-sans" : ""}">${escapeHtml(s.label)}</span>
      </button>`
    )
    .join("");
}

function renderSymbolGrid() {
  renderRecentSymbols();
  const q = state.searchQuery.trim().toLowerCase();
  const list = state.symbols.filter((s) => {
    if (q) {
      return (
        s.name.toLowerCase().includes(q) ||
        s.latex.toLowerCase().includes(q) ||
        s.keywords.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q)
      );
    }
    return s.category === state.activeTab;
  });

  $("symbol-count").textContent = `${list.length} élément${list.length > 1 ? "s" : ""}`;
  if (list.length === 0) {
    $("symbol-grid").innerHTML = `<div class="muted" style="font-size:12px;padding:8px">Aucun symbole trouvé pour « ${escapeHtml(state.searchQuery)} ».</div>`;
    return;
  }

  $("symbol-grid").innerHTML = list
    .map(
      (s) => `
      <button type="button" class="sym-btn" data-sym-id="${s.id}" aria-label="${escapeHtml(s.name)} (${escapeHtml(s.latex)})" title="${escapeHtml(s.name)} — ${escapeHtml(s.latex)}">
        ${s.swatch ? `<span class="sym-swatch" style="background:${s.swatch}"></span>` : ""}
        <span class="${s.swatch ? "sym-label-sans" : ""}">${escapeHtml(s.label)}</span>
      </button>`
    )
    .join("");
}

// ==================== Modals & Saved Drawer ====================
function openMatrixModal() {
  $("matrix-modal").classList.remove("hidden");
  renderMatrixUI();
}

function renderMatrixUI() {
  const m = state.matrix;
  $("matrix-types").innerHTML = MATRIX_TYPES.map(
    (t) => `
    <button type="button" class="matrix-type-btn ${m.env === t.id ? "active" : ""}" data-mat-env="${t.id}">
      <div>${escapeHtml(t.label)}</div>
      <small>${escapeHtml(t.hint)}</small>
    </button>`
  ).join("");

  $("mat-row-val").textContent = String(m.rows);
  $("mat-col-val").textContent = String(m.cols);
  $("mat-col-stepper").classList.toggle("hidden", m.env === "cases");

  const cols = m.env === "cases" ? 2 : m.cols;
  const grid = $("matrix-grid");
  grid.style.gridTemplateColumns = `repeat(${cols}, 76px)`;
  grid.innerHTML = Array.from({ length: m.rows })
    .map((_, r) =>
      Array.from({ length: cols })
        .map(
          (__, c) => `
        <input type="text" id="matrix-cell-${r}-${c}" name="matrix-cell-${r}-${c}" data-r="${r}" data-c="${c}" value="${escapeHtml(m.cells[r][c])}" placeholder="0" aria-label="Ligne ${r + 1}, colonne ${c + 1}" />`
        )
        .join("")
    )
    .join("");

  updateMatrixPreview();
}

function buildMatrixLatex() {
  const m = state.matrix;
  const cols = m.env === "cases" ? 2 : m.cols;
  const body = Array.from({ length: m.rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => m.cells[r][c].trim() || "0").join(" & ")
  ).join(" \\\\\n  ");
  return `\\begin{${m.env}}\n  ${body}\n\\end{${m.env}}`;
}

function updateMatrixPreview() {
  const latex = buildMatrixLatex();
  const res = renderLatexToSvg(latex, { displayLines: false, displayMode: true });
  if (res.error) {
    $("matrix-preview").innerHTML = `<span class="muted" style="font-size:12px">Syntaxe de cellule invalide : ${escapeHtml(res.error)}</span>`;
    return;
  }
  $("matrix-preview").innerHTML = res.svgHtml;
}

function openTemplatesModal() {
  $("templates-modal").classList.remove("hidden");
  renderTemplatesModal();
}

function renderTemplatesModal() {
  $("template-categories").innerHTML = TEMPLATE_CATEGORIES.map(
    (cat) => `
    <button type="button" class="tab-btn ${state.templateCat === cat ? "active" : ""}" data-tpl-cat="${cat}">${cat}</button>`
  ).join("");

  const list =
    state.templateCat === "Tous"
      ? state.templates
      : state.templates.filter((t) => t.category === state.templateCat);

  $("templates-grid").innerHTML = list
    .map((t) => {
      const svg = renderLatexToSvg(t.latex, { displayLines: false, displayMode: true }).svgHtml;
      return `
      <div class="template-card">
        <div>
          <div style="display:flex;align-items:center;gap:6px">
            <h3>${escapeHtml(t.title)}</h3>
            <span class="badge-engine">${escapeHtml(t.category)}</span>
          </div>
          <p>${escapeHtml(t.description)}</p>
        </div>
        <div class="template-preview"><div class="mathjax-output">${svg}</div></div>
        <div style="display:flex;justify-content:flex-end;gap:6px">
          <button type="button" class="btn-chip" data-tpl-insert="${t.id}">Insérer au curseur</button>
          <button type="button" class="btn-primary" data-tpl-load="${t.id}">Charger →</button>
        </div>
      </div>`;
    })
    .join("");
}

// ==================== Saved Snippets (100% Offline localStorage) ====================
function loadSavedFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_FALLBACK_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persistSaved() {
  state.saved.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  try {
    localStorage.setItem(SAVED_FALLBACK_KEY, JSON.stringify(state.saved));
  } catch {}
  updateSavedBadge();
}

function fetchSnippets() {
  state.saved = loadSavedFromStorage();
  persistSaved();
}

function updateSavedBadge() {
  const badge = $("saved-count-badge");
  badge.textContent = String(state.saved.length);
  badge.classList.toggle("hidden", state.saved.length === 0);
  $("saved-drawer-title").textContent = `Équations enregistrées (${state.saved.length})`;
}

function saveCurrentEquation() {
  const trimmed = state.latex.trim();
  if (!trimmed) return;
  const now = Date.now();
  const firstLine = trimmed.split("\n")[0].replace(/\\+/g, " ").trim();
  const title = firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine || "Équation sans titre";
  const created = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    latex: trimmed,
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };
  state.saved.unshift(created);
  persistSaved();
  if (!$("saved-drawer-backdrop").classList.contains("hidden")) renderSavedList();
  showToast("Équation enregistrée hors ligne");
}

function renderSavedList() {
  const q = $("saved-search").value.trim().toLowerCase();
  const list = state.saved.filter(
    (s) => !q || s.title.toLowerCase().includes(q) || s.latex.toLowerCase().includes(q)
  );
  if (list.length === 0) {
    $("saved-list").innerHTML = `<div class="muted" style="text-align:center;padding:32px 12px;font-size:12px">Aucune équation enregistrée. Utilisez <strong>Sauvegarder</strong> (ou Ctrl+S).</div>`;
    return;
  }
  $("saved-list").innerHTML = list
    .map((item) => {
      const svg = renderLatexToSvg(item.latex, { displayLines: true, displayMode: true }).svgHtml;
      return `
      <div class="saved-card" data-saved-id="${item.id}">
        <div class="saved-card-head">
          <button type="button" class="saved-title-btn" data-action="rename" title="Cliquer pour renommer">${escapeHtml(item.title)}</button>
          <div class="toolbar-group">
            <button type="button" class="btn-icon-sm" data-action="pin" title="${item.pinned ? "Désépingler" : "Épingler"}" aria-label="Épingler">
              <svg class="icon" viewBox="0 0 24 24" fill="${item.pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" style="${item.pinned ? "color:#f59e0b" : ""}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <button type="button" class="btn-icon-sm" data-action="copy" title="Copier LaTeX" aria-label="Copier LaTeX">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button type="button" class="btn-icon-sm danger" data-action="delete" title="Supprimer" aria-label="Supprimer">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="template-preview"><div class="mathjax-output">${svg}</div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px">
          <span class="muted">${new Date(item.updatedAt).toLocaleDateString("fr-FR")}</span>
          <button type="button" class="btn-primary" data-action="load" style="padding:4px 10px;font-size:11px">Ouvrir ↗</button>
        </div>
      </div>`;
    })
    .join("");
}

async function copyTextSafe(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Copie impossible");
}

async function exportStandaloneHtml() {
  try {
    showToast("Préparation du fichier autonome…", "info");
    const [htmlRes, cssRes, catRes, appRes, mjRes] = await Promise.all([
      fetch("/"),
      fetch("/static/app.css?v=6"),
      fetch("/static/catalog.js?v=6"),
      fetch("/static/app.js?v=6"),
      fetch("/static/vendor/tex-svg-full.js"),
    ]);
    if (!htmlRes.ok || !cssRes.ok || !catRes.ok || !appRes.ok || !mjRes.ok) {
      throw new Error("Impossible de récupérer toutes les ressources locales.");
    }
    const [htmlText, cssText, catText, appText, mjText] = await Promise.all([
      htmlRes.text(),
      cssRes.text(),
      catRes.text(),
      appRes.text(),
      mjRes.text(),
    ]);

    const escapeClosingScript = (code) => code.replace(/<\/script/gi, "<\\/script");
    const inlineCatalog = catText.replace(/^export\s+/gm, "");
    const originHost = window.location.hostname;
    const targetPublicUrl =
      window.location.protocol.startsWith("http") &&
      originHost !== "localhost" &&
      originHost !== "127.0.0.1"
        ? window.location.origin
        : PUBLIC_SITE_URL;
    const inlineApp = appText
      .replace(/^import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?\s*/m, "")
      .replace(/const PUBLIC_SITE_URL = "[^"]+";/, `const PUBLIC_SITE_URL = "${targetPublicUrl}";`);
    const bundleScript = escapeClosingScript(`(() => {\n${inlineCatalog}\n${inlineApp}\n})();`);
    const safeMathJax = escapeClosingScript(mjText);
    const inlineFavicon =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%236366f1'/%3E%3Cstop offset='100%25' stop-color='%237c3aed'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='16' fill='url(%23g)'/%3E%3Ctext x='50%25' y='53%25' dominant-baseline='middle' text-anchor='middle' font-family='Georgia,serif' font-weight='bold' font-size='38' fill='white'%3E%CE%A3%3C/text%3E%3C/svg%3E";

    let outHtml = htmlText
      .replace(/<link\s+rel="manifest"[^>]*>\s*/i, "")
      .replace(/<link\s+rel="apple-touch-icon"[^>]*>\s*/i, "")
      .replace(/href="\/icon\.svg"/i, `href="${inlineFavicon}"`)
      .replace(/<link\s+rel="stylesheet"\s+href="\/static\/app\.css[^"]*"\s*\/>/i, () => `<style>\n${cssText}\n</style>`)
      .replace(/<script[^>]*id="MathJax-script"[^>]*><\/script>/i, () => `<script>\n${safeMathJax}\n</script>`)
      .replace(/<script\s+type="module"\s+src="\/static\/app\.js[^"]*"><\/script>/i, () => `<script>\n${bundleScript}\n</script>`);

    const blob = new Blob([outHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "latex-studio.html";
    a.click();
    URL.revokeObjectURL(url);
    showToast("latex-studio.html téléchargé (100% autonome)");
  } catch (e) {
    showToast(e.message || "Erreur lors de l'export autonome", "error");
  }
}

// ==================== Share Link (100% Client Hash) ====================
async function shareEquation() {
  const trimmed = state.latex.trim();
  if (!trimmed) return;
  const hash = `#tex=${encodeLatexFromString(trimmed)}`;
  let shareUrl;
  if (window.location.protocol === "file:") {
    window.location.hash = hash;
    shareUrl = `${PUBLIC_SITE_URL.replace(/\/+$/, "")}/${hash}`;
  } else {
    window.history.replaceState(null, "", hash);
    shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;
  }
  try {
    await copyTextSafe(shareUrl);
    showToast("Lien de partage copié !");
  } catch {
    showToast("URL mise à jour dans la barre d'adresse", "info");
  }
}

// ==================== Event Wiring & Init ====================
function wireEvents() {
  $("btn-theme").addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
  $("btn-toggle-layout").addEventListener("click", () => {
    state.layoutMode = state.layoutMode === "split" ? "focus" : "split";
    $("workspace-main").classList.toggle("focus-mode", state.layoutMode === "focus");
  });
  $("btn-share").addEventListener("click", shareEquation);
  $("btn-open-help").addEventListener("click", () => $("help-modal").classList.remove("hidden"));
  $("help-modal").addEventListener("click", (e) => {
    const qBtn = e.target.closest("[data-quick-latex]");
    if (!qBtn) return;
    insertSnippet(qBtn.dataset.quickLatex, 0);
    $("help-modal").classList.add("hidden");
  });

  // Header export menu
  $("btn-header-export").addEventListener("click", () => $("header-export-menu").classList.toggle("hidden"));
  $("header-export-menu").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    $("header-export-menu").classList.add("hidden");
    const act = btn.dataset.action;
    if (act === "copy-png") copyPng();
    if (act === "copy-svg") copySvg();
    if (act === "export-png") exportPng();
    if (act === "export-svg") exportSvg();
    if (act === "export-tex") exportTex();
    if (act === "export-pdf") window.print();
    if (act === "export-standalone-html") exportStandaloneHtml();
  });

  // Ribbon tabs & search
  $("symbol-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    state.searchQuery = "";
    $("symbol-search").value = "";
    $("btn-clear-search").classList.add("hidden");
    state.activeTab = btn.dataset.tab;
    if (state.ribbonCollapsed) {
      state.ribbonCollapsed = false;
      $("ribbon-body").classList.remove("hidden");
    }
    renderSymbolTabs();
    renderSymbolGrid();
  });

  $("symbol-search").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    $("btn-clear-search").classList.toggle("hidden", !state.searchQuery);
    if (state.searchQuery && state.ribbonCollapsed) {
      state.ribbonCollapsed = false;
      $("ribbon-body").classList.remove("hidden");
    }
    renderSymbolTabs();
    renderSymbolGrid();
  });

  $("btn-clear-search").addEventListener("click", () => {
    state.searchQuery = "";
    $("symbol-search").value = "";
    $("btn-clear-search").classList.add("hidden");
    renderSymbolTabs();
    renderSymbolGrid();
  });

  $("btn-collapse-ribbon").addEventListener("click", () => {
    state.ribbonCollapsed = !state.ribbonCollapsed;
    $("ribbon-body").classList.toggle("hidden", state.ribbonCollapsed);
    $("icon-ribbon-chev").classList.toggle("rotated", state.ribbonCollapsed);
  });

  const handleSymPick = (e) => {
    const btn = e.target.closest("[data-sym-id]");
    if (!btn) return;
    const sym = state.symbols.find((s) => s.id === btn.dataset.symId);
    if (sym) {
      recordRecentSymbol(sym.id);
      insertSnippet(sym.latex, sym.cursorOffset || 0);
    }
  };
  const handleSymHover = (e) => {
    const btn = e.target.closest("[data-sym-id]");
    if (!btn) return;
    const sym = state.symbols.find((s) => s.id === btn.dataset.symId);
    if (sym) {
      $("inspector-text").innerHTML = `<strong>${escapeHtml(sym.name)}</strong> · <code>${escapeHtml(sym.latex.trim())}</code>`;
    }
  };
  $("symbol-grid").addEventListener("click", handleSymPick);
  $("symbol-grid").addEventListener("mouseover", handleSymHover);
  $("recent-symbols-list").addEventListener("click", handleSymPick);
  $("recent-symbols-list").addEventListener("mouseover", handleSymHover);

  // Editor events
  textarea.addEventListener("input", () => {
    setLatexValue(textarea.value);
    updateAutocomplete();
  });
  textarea.addEventListener("scroll", () => {
    highlightEl.scrollTop = textarea.scrollTop;
    highlightEl.scrollLeft = textarea.scrollLeft;
    gutterEl.scrollTop = textarea.scrollTop;
  });
  textarea.addEventListener("keydown", (e) => {
    if (state.acCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        state.acIndex = (state.acIndex + 1) % state.acCandidates.length;
        renderAutocomplete();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        state.acIndex = (state.acIndex - 1 + state.acCandidates.length) % state.acCandidates.length;
        renderAutocomplete();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptAutocomplete(state.acCandidates[state.acIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        hideAutocomplete();
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) $("btn-redo").click();
      else $("btn-undo").click();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      $("btn-redo").click();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const s = textarea.selectionStart;
      const en = textarea.selectionEnd;
      if (s === en) {
        const nextEmpty = state.latex.indexOf("{}", s);
        if (nextEmpty !== -1 && nextEmpty - s <= 40) {
          textarea.setSelectionRange(nextEmpty + 1, nextEmpty + 1);
          return;
        }
      }
      setLatexValue(state.latex.slice(0, s) + "  " + state.latex.slice(en));
      requestAnimationFrame(() => textarea.setSelectionRange(s + 2, s + 2));
      return;
    }
    if (e.key === "Backspace") {
      const s = textarea.selectionStart;
      const en = textarea.selectionEnd;
      if (s === en && s > 0 && PAIRS[state.latex[s - 1]] === state.latex[s]) {
        e.preventDefault();
        setLatexValue(state.latex.slice(0, s - 1) + state.latex.slice(s + 1));
        requestAnimationFrame(() => textarea.setSelectionRange(s - 1, s - 1));
        return;
      }
    }
    if ((e.key === "}" || e.key === "]" || e.key === ")") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const s = textarea.selectionStart;
      const en = textarea.selectionEnd;
      if (s === en && state.latex[s] === e.key) {
        e.preventDefault();
        textarea.setSelectionRange(s + 1, s + 1);
        return;
      }
    }
    if (PAIRS[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const s = textarea.selectionStart;
      const en = textarea.selectionEnd;
      const sel = state.latex.slice(s, en);
      setLatexValue(state.latex.slice(0, s) + e.key + sel + PAIRS[e.key] + state.latex.slice(en));
      requestAnimationFrame(() => textarea.setSelectionRange(s + 1, sel ? en + 1 : s + 1));
    }
  });

  acPopup.addEventListener("mousedown", (e) => {
    const btn = e.target.closest("[data-ac-idx]");
    if (!btn) return;
    e.preventDefault();
    acceptAutocomplete(state.acCandidates[Number(btn.dataset.acIdx)]);
  });

  $("btn-undo").addEventListener("click", () => {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    setLatexValue(state.history[state.historyIndex], { recordHistory: false });
    $("btn-undo").disabled = state.historyIndex <= 0;
    $("btn-redo").disabled = state.historyIndex >= state.history.length - 1;
  });
  $("btn-redo").addEventListener("click", () => {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    setLatexValue(state.history[state.historyIndex], { recordHistory: false });
    $("btn-undo").disabled = state.historyIndex <= 0;
    $("btn-redo").disabled = state.historyIndex >= state.history.length - 1;
  });

  $("btn-one-line").addEventListener("click", () => {
    const collapsed = state.latex.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" ");
    setLatexValue(collapsed);
  });
  $("btn-display-lines").addEventListener("click", () => {
    state.prefs.displayLines = !state.prefs.displayLines;
    $("btn-display-lines").classList.toggle("active", state.prefs.displayLines);
    savePrefs();
    updatePreview();
  });
  $("btn-clear-editor").addEventListener("click", () => setLatexValue(""));
  $("btn-save-snippet").addEventListener("click", saveCurrentEquation);

  // Copy LaTeX formats
  const copyLatex = async (fmt) => {
    const t = state.latex.trim();
    if (!t) return;
    const out = fmt === "inline" ? `$${t}$` : fmt === "block" ? `$$\n${t}\n$$` : t;
    await navigator.clipboard.writeText(out);
    showToast("Code LaTeX copié");
  };
  $("btn-copy-latex").addEventListener("click", () => copyLatex("raw"));
  $("btn-copy-latex-menu").addEventListener("click", () => $("copy-latex-menu").classList.toggle("hidden"));
  $("copy-latex-menu").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    $("copy-latex-menu").classList.add("hidden");
    copyLatex(btn.dataset.copy);
  });

  // Preview controls & Zoom
  $("preview-font-size").addEventListener("input", (e) => setFontSize(Number(e.target.value)));
  $("btn-zoom-out").addEventListener("click", () => setFontSize(state.prefs.fontSize - 4));
  $("btn-zoom-in").addEventListener("click", () => setFontSize(state.prefs.fontSize + 4));
  $("preview-canvas").addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setFontSize(state.prefs.fontSize + (e.deltaY < 0 ? 2 : -2));
      }
    },
    { passive: false }
  );

  // Draggable split resizer
  const resizer = $("split-resizer");
  const wsMain = $("workspace-main");
  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    resizer.classList.add("dragging");
    const onMove = (ev) => {
      const rect = wsMain.getBoundingClientRect();
      const pct = Math.max(25, Math.min(75, ((ev.clientX - rect.left) / rect.width) * 100));
      state.splitPct = Math.round(pct * 10) / 10;
      wsMain.style.setProperty("--split-left", `${state.splitPct}%`);
    };
    const onUp = () => {
      resizer.classList.remove("dragging");
      try {
        localStorage.setItem(SPLIT_KEY, String(state.splitPct));
      } catch {}
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
  resizer.addEventListener("dblclick", () => {
    state.splitPct = 50;
    wsMain.style.setProperty("--split-left", "50%");
    try {
      localStorage.setItem(SPLIT_KEY, "50");
    } catch {}
  });

  document.querySelectorAll("[data-bg]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.prefs.previewBg = btn.dataset.bg;
      document.querySelectorAll("[data-bg]").forEach((b) => b.classList.toggle("active", b === btn));
      $("preview-canvas").className = `preview-canvas bg-${state.prefs.previewBg}`;
      savePrefs();
    })
  );

  $("btn-display-mode").addEventListener("click", () => {
    state.prefs.displayMode = !state.prefs.displayMode;
    $("btn-display-mode").textContent = state.prefs.displayMode ? "Bloc ($$)" : "Inline ($)";
    savePrefs();
    updatePreview();
  });

  $("btn-preview-copy-png").addEventListener("click", copyPng);
  $("btn-preview-png").addEventListener("click", exportPng);
  $("btn-preview-svg").addEventListener("click", exportSvg);
  $("btn-preview-pdf").addEventListener("click", () => window.print());
  $("btn-export-settings").addEventListener("click", () => $("export-settings-popover").classList.toggle("hidden"));

  $("export-scale-btns").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-scale]");
    if (!btn) return;
    state.prefs.exportScale = Number(btn.dataset.scale);
    $("export-scale-btns").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    savePrefs();
  });
  $("export-padding").addEventListener("input", (e) => {
    state.prefs.exportPadding = Number(e.target.value);
    $("export-padding-val").textContent = `${state.prefs.exportPadding}px`;
    savePrefs();
  });
  $("export-bg-btns").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ebg]");
    if (!btn) return;
    state.prefs.exportBg = btn.dataset.ebg;
    $("export-bg-btns").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    $("export-custom-bg-row").classList.toggle("hidden", state.prefs.exportBg !== "custom");
    savePrefs();
  });
  $("export-custom-color").addEventListener("input", (e) => {
    state.prefs.exportCustomBg = e.target.value;
    $("export-custom-color-val").textContent = e.target.value;
    savePrefs();
  });
  $("export-ink-btns").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ink]");
    if (!btn) return;
    state.prefs.exportInkOverride = btn.dataset.ink;
    $("export-ink-btns").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    savePrefs();
  });

  document.querySelectorAll("[data-starter]").forEach((btn) =>
    btn.addEventListener("click", () => setLatexValue(btn.dataset.starter))
  );

  // Modals open/close
  $("btn-open-matrix").addEventListener("click", openMatrixModal);
  $("btn-open-templates").addEventListener("click", openTemplatesModal);
  $("btn-open-saved").addEventListener("click", () => {
    $("saved-drawer-backdrop").classList.remove("hidden");
    renderSavedList();
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) =>
    btn.addEventListener("click", () => $(btn.dataset.closeModal).classList.add("hidden"))
  );
  ["matrix-modal", "templates-modal", "help-modal", "saved-drawer-backdrop"].forEach((id) => {
    $(id).addEventListener("click", (e) => {
      if (e.target.id === id) $(id).classList.add("hidden");
    });
  });

  // Matrix Modal interactions
  $("matrix-types").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mat-env]");
    if (!btn) return;
    state.matrix.env = btn.dataset.matEnv;
    renderMatrixUI();
  });
  $("mat-row-dec").addEventListener("click", () => { state.matrix.rows = Math.max(1, state.matrix.rows - 1); renderMatrixUI(); });
  $("mat-row-inc").addEventListener("click", () => { state.matrix.rows = Math.min(8, state.matrix.rows + 1); renderMatrixUI(); });
  $("mat-col-dec").addEventListener("click", () => { state.matrix.cols = Math.max(1, state.matrix.cols - 1); renderMatrixUI(); });
  $("mat-col-inc").addEventListener("click", () => { state.matrix.cols = Math.min(8, state.matrix.cols + 1); renderMatrixUI(); });
  $("matrix-grid").addEventListener("input", (e) => {
    if (e.target.tagName !== "INPUT") return;
    state.matrix.cells[Number(e.target.dataset.r)][Number(e.target.dataset.c)] = e.target.value;
    updateMatrixPreview();
  });
  $("mat-fill-identity").addEventListener("click", () => {
    state.matrix.cells = state.matrix.cells.map((row, r) =>
      row.map((_, c) => (state.matrix.env === "cases" ? (c === 0 ? `x + ${r + 1}` : `\\text{si } x > ${r}`) : r === c ? "1" : "0"))
    );
    renderMatrixUI();
  });
  $("mat-clear").addEventListener("click", () => {
    state.matrix.cells = state.matrix.cells.map((row) => row.map(() => ""));
    renderMatrixUI();
  });
  $("mat-insert-btn").addEventListener("click", () => {
    insertSnippet(buildMatrixLatex(), 0);
    $("matrix-modal").classList.add("hidden");
  });

  // Templates Modal interactions
  $("template-categories").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tpl-cat]");
    if (!btn) return;
    state.templateCat = btn.dataset.tplCat;
    renderTemplatesModal();
  });
  $("templates-grid").addEventListener("click", (e) => {
    const ins = e.target.closest("[data-tpl-insert]");
    const load = e.target.closest("[data-tpl-load]");
    if (ins) {
      const tpl = state.templates.find((t) => t.id === ins.dataset.tplInsert);
      if (tpl) insertSnippet(tpl.latex, 0);
      $("templates-modal").classList.add("hidden");
    } else if (load) {
      const tpl = state.templates.find((t) => t.id === load.dataset.tplLoad);
      if (tpl) setLatexValue(tpl.latex);
      $("templates-modal").classList.add("hidden");
    }
  });

  // Saved Drawer interactions
  $("saved-search").addEventListener("input", renderSavedList);
  $("saved-list").addEventListener("click", async (e) => {
    const card = e.target.closest("[data-saved-id]");
    const actBtn = e.target.closest("[data-action]");
    if (!card || !actBtn) return;
    const id = card.dataset.savedId;
    const item = state.saved.find((s) => s.id === id);
    if (!item) return;
    const act = actBtn.dataset.action;

    if (act === "load") {
      setLatexValue(item.latex);
      $("saved-drawer-backdrop").classList.add("hidden");
      showToast("Équation chargée", "info");
    } else if (act === "copy") {
      await navigator.clipboard.writeText(item.latex);
      showToast("Code LaTeX copié");
    } else if (act === "pin") {
      item.pinned = !item.pinned;
      item.updatedAt = Date.now();
      persistSaved();
      renderSavedList();
    } else if (act === "delete") {
      state.saved = state.saved.filter((s) => s.id !== id);
      persistSaved();
      renderSavedList();
      showToast("Équation supprimée", "info");
    } else if (act === "rename") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "saved-rename-input";
      input.value = item.title;
      input.setAttribute("aria-label", "Nouveau titre de l'équation");
      actBtn.replaceWith(input);
      input.focus();
      input.select();

      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        const val = input.value.trim();
        if (commit && val && val !== item.title) {
          item.title = val;
          item.updatedAt = Date.now();
          persistSaved();
        }
        renderSavedList();
      };
      input.addEventListener("blur", () => finish(true));
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          finish(true);
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          finish(false);
        }
      });
    }
  });

  $("btn-export-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.saved, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "latex-studio-equations.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  $("import-json-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed)) {
          const existing = new Set(state.saved.map((x) => x.id));
          let added = 0;
          const now = Date.now();
          for (const entry of parsed) {
            if (!entry || typeof entry.latex !== "string" || !entry.latex.trim()) continue;
            const id = entry.id || `${now}-${Math.random().toString(36).slice(2, 7)}`;
            if (existing.has(id)) continue;
            existing.add(id);
            state.saved.push({
              id,
              title: typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : "Équation importée",
              latex: entry.latex.trim(),
              createdAt: entry.createdAt || now,
              updatedAt: entry.updatedAt || now,
              pinned: Boolean(entry.pinned),
            });
            added++;
          }
          persistSaved();
          renderSavedList();
          showToast(`${added} équation(s) importée(s)`);
        }
      } catch {
        showToast("Fichier JSON invalide", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // Global keyboard shortcuts & outside clicks
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ["matrix-modal", "templates-modal", "help-modal", "saved-drawer-backdrop", "header-export-menu", "copy-latex-menu", "export-settings-popover"].forEach((id) =>
        $(id).classList.add("hidden")
      );
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("symbol-search").focus();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveCurrentEquation();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
      if (state.latex.trim()) {
        e.preventDefault();
        copyPng();
      }
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (!$("header-export-wrap").contains(e.target)) $("header-export-menu").classList.add("hidden");
    if (!$("copy-latex-wrap").contains(e.target)) $("copy-latex-menu").classList.add("hidden");
    if (!$("export-settings-wrap").contains(e.target)) $("export-settings-popover").classList.add("hidden");
  });
}

function setupPWA() {
  const badge = $("offline-badge");
  if (window.location.protocol === "file:") {
    if (badge) {
      badge.textContent = "Mode autonome";
      badge.className = "offline-badge cached";
    }
    const standaloneBtn = $("btn-export-standalone");
    if (standaloneBtn) standaloneBtn.classList.add("hidden");
    return;
  }

  const updateOnlineStatus = (cachedReady = false) => {
    if (!badge) return;
    if (!navigator.onLine) {
      badge.textContent = "Hors ligne (cache)";
      badge.className = "offline-badge offline";
    } else if (cachedReady || navigator.serviceWorker?.controller) {
      badge.textContent = "Prêt hors ligne";
      badge.className = "offline-badge cached";
    } else {
      badge.textContent = "En ligne";
      badge.className = "offline-badge";
    }
  };

  window.addEventListener("online", () => updateOnlineStatus());
  window.addEventListener("offline", () => updateOnlineStatus());
  updateOnlineStatus();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.active) updateOnlineStatus(true);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") {
              updateOnlineStatus(true);
            }
          });
        });
      })
      .catch(() => {});
  }

  let deferredPrompt = null;
  const installBtn = $("btn-install-pwa");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.classList.remove("hidden");
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === "accepted") {
        installBtn.classList.add("hidden");
        showToast("LaTeX Studio installé !");
      }
    });
  }

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (installBtn) installBtn.classList.add("hidden");
  });
}

async function init() {
  applyTheme(state.theme);
  $("workspace-main").style.setProperty("--split-left", `${state.splitPct}%`);
  $("preview-font-size").value = String(state.prefs.fontSize);
  $("preview-font-size-val").textContent = `${state.prefs.fontSize}px`;
  $("btn-display-lines").classList.toggle("active", state.prefs.displayLines);
  $("btn-display-mode").textContent = state.prefs.displayMode ? "Bloc ($$)" : "Inline ($)";
  $("preview-canvas").className = `preview-canvas bg-${state.prefs.previewBg}`;
  document.querySelectorAll("[data-bg]").forEach((b) => b.classList.toggle("active", b.dataset.bg === state.prefs.previewBg));

  wireEvents();
  setupPWA();

  state.categories = SYMBOL_CATEGORIES;
  state.symbols = SYMBOLS;
  state.templates = TEMPLATES;
  fetchSnippets();

  setLatexValue(state.latex, { recordHistory: true });
  renderSymbolTabs();
  renderSymbolGrid();

  const ready = await waitForMathJax();
  state.mathjaxReady = ready;
  $("mathjax-dot").className = `status-dot ${ready ? "ready" : "loading"}`;
  $("mathjax-status").textContent = ready ? "MathJax prêt" : "MathJax indisponible";
  if (ready) updatePreview();
}

init();
