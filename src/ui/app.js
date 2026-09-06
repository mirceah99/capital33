const SLOT = 17; // px per 1h slot
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

const els = {
  select: document.getElementById("scenarioSelect"),
  loadBtn: document.getElementById("loadBtn"),
  status: document.getElementById("status"),
  prev: document.getElementById("prevWeek"),
  next: document.getElementById("nextWeek"),
  weekLabel: document.getElementById("weekLabel"),
  gantt: document.getElementById("gantt"),
};

let scenario = null; // resolved scenario currently displayed
let weekStarts = []; // list of week-start timestamps (Monday 00:00 UTC)
let weekIdx = 0;

const api = {
  scenarios: () => fetch("/api/scenarios").then((r) => r.json()),
  resolved: () => fetch("/api/resolved").then((r) => r.json()),
  load: (file) => fetch(`/api/load/${file}`, { method: "POST" }).then((r) => r.json()),
  resolve: () => fetch("/api/resolve", { method: "POST" }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || "resolve failed");
    return body;
  }),
};

function setStatus(msg, kind = "") {
  els.status.textContent = msg;
  els.status.className = "status " + kind;
}

// Monday 00:00 UTC of the week containing ts
function mondayUTC(ts) {
  const d = new Date(ts);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // days since Monday
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset);
}

function allIntervals() {
  if (!scenario) return [];
  return scenario.settlementChannels.flatMap((c) => c.data.intervals || []);
}

function computeWeeks() {
  const ivs = allIntervals();
  weekStarts = [];
  if (ivs.length === 0) return;
  let min = Infinity;
  let max = -Infinity;
  for (const iv of ivs) {
    min = Math.min(min, Date.parse(iv.starDate));
    max = Math.max(max, Date.parse(iv.endDate));
  }
  let w = mondayUTC(min);
  while (w < max) {
    weekStarts.push(w);
    w += WEEK_MS;
  }
  if (weekStarts.length === 0) weekStarts.push(mondayUTC(min));
  weekIdx = Math.min(weekIdx, weekStarts.length - 1);
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtDay(ts) {
  const d = new Date(ts);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function render() {
  els.gantt.innerHTML = "";
  if (!scenario || weekStarts.length === 0) {
    els.gantt.innerHTML = `<div class="empty">No resolved scenario yet. Pick one above and press <b>Load &amp; Resolve</b>.</div>`;
    els.weekLabel.textContent = "No data";
    els.prev.disabled = els.next.disabled = true;
    return;
  }

  const weekStart = weekStarts[weekIdx];
  const weekEnd = weekStart + WEEK_MS;
  const widthPx = 7 * 24 * SLOT;

  els.weekLabel.textContent = `Week of ${fmtDay(weekStart)} (${weekIdx + 1}/${weekStarts.length})`;
  els.prev.disabled = weekIdx === 0;
  els.next.disabled = weekIdx === weekStarts.length - 1;

  const grid = document.createElement("div");
  grid.className = "grid";

  // header
  const head = document.createElement("div");
  head.className = "head-row";
  const corner = document.createElement("div");
  corner.className = "corner";
  corner.textContent = "Channel \\ Time (UTC)";
  head.appendChild(corner);

  const th = document.createElement("div");
  th.className = "timeline-head";
  th.style.width = widthPx + "px";
  for (let d = 0; d < 7; d++) {
    const day = document.createElement("div");
    day.className = "day-head";
    day.style.left = d * 24 * SLOT + "px";
    day.style.width = 24 * SLOT + "px";
    day.textContent = `${DAY_NAMES[d]} ${fmtDay(weekStart + d * DAY_MS)}`;
    th.appendChild(day);
    for (let h = 0; h < 24; h++) {
      const tick = document.createElement("div");
      tick.className = "hour-tick";
      tick.style.left = (d * 24 + h) * SLOT + "px";
      tick.textContent = h;
      th.appendChild(tick);
    }
  }
  head.appendChild(th);
  grid.appendChild(head);

  // channel rows
  for (const channel of scenario.settlementChannels) {
    const row = document.createElement("div");
    row.className = "chan-row";

    const label = document.createElement("div");
    label.className = "row-label";
    label.textContent = channel.data.name;
    label.title = channel.docId;
    row.appendChild(label);

    const track = document.createElement("div");
    track.className = "track";
    track.style.width = widthPx + "px";

    for (let d = 1; d < 7; d++) {
      const sep = document.createElement("div");
      sep.className = "day-sep";
      sep.style.left = d * 24 * SLOT + "px";
      track.appendChild(sep);
    }

    for (const iv of channel.data.intervals || []) {
      const s = Date.parse(iv.starDate);
      const e = Date.parse(iv.endDate);
      if (e <= weekStart || s >= weekEnd) continue;
      const cs = Math.max(s, weekStart);
      const ce = Math.min(e, weekEnd);
      const left = ((cs - weekStart) / HOUR_MS) * SLOT;
      const width = ((ce - cs) / HOUR_MS) * SLOT;

      const block = document.createElement("div");
      block.className = "block " + iv.type;
      block.style.left = left + "px";
      block.style.width = Math.max(width - 1, 1) + "px";
      if (iv.type === "task") block.textContent = iv.taskId || "task";
      block.title = `${iv.type}${iv.taskId ? " · " + iv.taskId : ""}\n${fmtDateTime(iv.starDate)} → ${fmtDateTime(iv.endDate)}`;
      track.appendChild(block);
    }

    row.appendChild(track);
    grid.appendChild(row);
  }

  els.gantt.appendChild(grid);
}

async function loadAndResolve() {
  const file = els.select.value;
  if (!file) return;
  try {
    setStatus("Loading…");
    await api.load(file);
    setStatus("Resolving…");
    scenario = await api.resolve();
    computeWeeks();
    weekIdx = 0;
    render();
    setStatus("Resolved ✓", "ok");
  } catch (err) {
    setStatus(err.message || String(err), "error");
  }
}

async function init() {
  const list = await api.scenarios();
  els.select.innerHTML = list
    .map((s) => `<option value="${s.file}">${s.name}</option>`)
    .join("");

  scenario = await api.resolved();
  if (scenario) {
    computeWeeks();
    setStatus("Loaded last resolved scenario", "ok");
  }
  render();

  els.loadBtn.addEventListener("click", loadAndResolve);
  els.prev.addEventListener("click", () => { if (weekIdx > 0) { weekIdx--; render(); } });
  els.next.addEventListener("click", () => { if (weekIdx < weekStarts.length - 1) { weekIdx++; render(); } });
}

init();
