import { DEVICES, LIMITS, assess, createDemo, toCsv } from "./domain.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let data = createDemo(),
  selected = "BW-002",
  view = "overview",
  paused = false,
  clock = Date.now(),
  tick = 90,
  live = false,
  token = "",
  pollBusy = false;
const scenarios = Object.fromEntries(
  DEVICES.map((d) => [d.id, d.id === "BW-002" ? "rough" : "normal"]),
);
let records = [];
try {
  records = JSON.parse(localStorage.getItem("benchwatch-demo-notes") || "[]");
  if (!Array.isArray(records)) records = [];
} catch {}
const names = {
  overview: [
    "Overview",
    "A pulse on your workshop.",
    "See the unusual. Understand the signal. Keep a record.",
  ],
  devices: [
    "Device fleet",
    "Every signal has a source.",
    "Four demo channels. One clear view of equipment condition.",
  ],
  incidents: [
    "Maintenance",
    "Turn signals into action.",
    "Review sustained anomalies and keep a local maintenance log.",
  ],
  integration: [
    "Connect hardware",
    "From the bench to the cloud.",
    "An Arduino-compatible sensor path, with honest validation boundaries.",
  ],
};
const state = (d) =>
  assess(data[d.id] || [], d.baseline, live ? Date.now() : clock);
const pill = (s) =>
  '<span class="pill ' + s.status + '"><i></i>' + s.label + "</span>";
const button = (label, action, cls = "") =>
  '<button class="button ' +
  cls +
  '" data-action="' +
  action +
  '">' +
  label +
  "</button>";
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 3300);
}
function modal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal").showModal();
}
function setView(v) {
  if (!names[v]) return;
  view = v;
  history.replaceState(null, "", "#" + v);
  render();
}
function stats() {
  const statuses = DEVICES.map(state),
    online = statuses.filter((s) => s.status !== "offline").length,
    alerts = statuses.filter((s) => s.status === "attention").length,
    packets = Object.values(data).reduce((n, a) => n + a.length, 0);
  return (
    '<section class="stats">' +
    [
      [
        "Reporting devices",
        String(online).padStart(2, "0"),
        "/ 04",
        "Current sample window",
        "▣",
      ],
      [
        "Needs attention",
        String(alerts).padStart(2, "0"),
        "",
        "Sustained anomalies, not predictions",
        "⚑",
      ],
      [
        "Samples in view",
        packets.toLocaleString(),
        "",
        "Latest 90 samples per device",
        "⌁",
      ],
      [
        "Detection window",
        "03",
        "samples",
        "Consecutive threshold crossings",
        "◷",
      ],
    ]
      .map(
        (a, i) =>
          '<div class="stat"><div class="stat-label">' +
          a[0] +
          '<span class="stat-icon">' +
          a[4] +
          '</span></div><div class="stat-value">' +
          a[1] +
          "<span>" +
          a[2] +
          '</span></div><div class="stat-foot ' +
          (i === 1 ? "attention" : "") +
          '">' +
          a[3] +
          "</div></div>",
      )
      .join("") +
    "</section>"
  );
}
function chart(samples, d) {
  if (!samples.length)
    return '<div class="chart-empty">Waiting for the first reading</div>';
  const max = Math.max(2, ...samples.map((s) => s.vibrationRms * 1.2)),
    threshold = Math.max(LIMITS.vibration, d.baseline * LIMITS.baselineRatio),
    y = (v) => 160 - (v / max) * 145;
  let p = samples
    .map(
      (s, i) =>
        (34 + (i / (samples.length - 1 || 1)) * 570).toFixed(1) +
        "," +
        y(s.vibrationRms).toFixed(1),
    )
    .join(" ");
  return (
    '<svg class="chart" viewBox="0 0 628 194" role="img" aria-label="Vibration RMS over the latest sample window"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8dae69" stop-opacity=".26"/><stop offset="1" stop-color="#8dae69" stop-opacity="0"/></linearGradient></defs>' +
    [0, 0.25, 0.5, 0.75, 1]
      .map(
        (f) =>
          '<path d="M34 ' +
          y(f * max) +
          'H607" stroke="#e8ede2" stroke-dasharray="3 4"/><text x="0" y="' +
          (y(f * max) + 3) +
          '">' +
          (f * max).toFixed(1) +
          "</text>",
      )
      .join("") +
    '<polygon points="34,160 ' +
    p +
    ' 604,160" fill="url(#area)"/><path d="M34 ' +
    y(threshold) +
    'H607" stroke="#c79254" stroke-dasharray="5 4"/><polyline points="' +
    p +
    '" fill="none" stroke="#6f935a" stroke-width="2"/><circle cx="604" cy="' +
    y(samples.at(-1).vibrationRms) +
    '" r="4" fill="#5c8142" stroke="white" stroke-width="2"/>' +
    [0, 30, 60, 89]
      .map((i) => {
        const s = samples[Math.min(i, samples.length - 1)];
        return (
          '<text x="' +
          (34 + (i / 89) * 552) +
          '" y="186">' +
          new Date(s.timestamp).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }) +
          "</text>"
        );
      })
      .join("") +
    "</svg>"
  );
}
function schematic() {
  return (
    '<aside class="panel machine-panel"><div class="panel-head"><div><p class="panel-kicker">SENSOR NODE / REV 01</p><h3>Small hardware. Useful signals.</h3></div></div><div class="machine-schematic"><svg viewBox="0 0 270 180" role="img" aria-label="Functional wiring diagram: DS18B20 and ADXL345 connected to an ESP32, sending HTTPS telemetry"><path d="M43 63H80V77H103M43 132H80V107H103M184 92H235" fill="none" stroke="#8c9f77" stroke-width="2"/><rect x="7" y="43" width="59" height="38" rx="4" fill="#f5f7eb" stroke="#98aa83"/><text x="17" y="59" class="schematic-label">TEMP</text><text x="14" y="72" class="schematic-label">DS18B20</text><rect x="7" y="111" width="59" height="39" rx="4" fill="#f5f7eb" stroke="#98aa83"/><text x="17" y="127" class="schematic-label">ACCEL</text><text x="14" y="141" class="schematic-label">ADXL345</text><rect x="100" y="48" width="85" height="92" rx="7" fill="#344c35"/><rect x="111" y="57" width="63" height="40" rx="3" fill="#91a883"/><text x="120" y="80" style="fill:#203823;font:12px monospace">ESP32</text><path d="M115 108H155M115 115H164M115 122H143" stroke="#c4d6af" stroke-width="2"/>' +
    [0, 1, 2, 3, 4, 5]
      .map(
        (i) =>
          '<path d="M95 ' +
          (59 + i * 14) +
          "h5M185 " +
          (59 + i * 14) +
          'h5" stroke="#5c714a" stroke-width="3"/>',
      )
      .join("") +
    '<circle cx="239" cy="92" r="19" fill="#d5f77e" stroke="#92ab6d"/><text x="225" y="96" style="font:9px monospace;fill:#476638">TLS</text><text x="84" y="170" class="schematic-label">FEATURES, NOT RAW AUDIO</text></svg></div><div class="device-channels"><div class="channel"><span>CH 01 / temperature</span><b>1-WIRE</b></div><div class="channel"><span>CH 02 / acceleration</span><b>I²C</b></div><div class="channel"><span>Uplink / telemetry</span><b>HTTPS</b></div></div><div class="board-tag"><span>ARDUINO-COMPATIBLE</span><span>HARDWARE GUIDE</span></div></aside>'
  );
}
function telemetry() {
  const d = DEVICES.find((d) => d.id === selected),
    samples = data[selected] || [],
    s = state(d),
    last = samples.at(-1),
    ratio = last ? last.vibrationRms / d.baseline : 0;
  return (
    '<div class="main-grid"><section class="panel"><div class="panel-head"><div><p class="panel-kicker">LIVE TELEMETRY</p><h2>Read the room. And the machine.</h2></div>' +
    pill(s) +
    '</div><div class="telemetry-head"><div class="device-select"><select id="device-select" aria-label="Select a device">' +
    DEVICES.map(
      (x) =>
        '<option value="' +
        x.id +
        '" ' +
        (x.id === selected ? "selected" : "") +
        ">" +
        x.name +
        "</option>",
    ).join("") +
    '</select><span class="device-id">' +
    d.id +
    '</span></div><span class="live-label">' +
    (live ? "SENSOR API" : paused ? "Ⅱ PAUSED" : "↻ SIMULATION") +
    '</span></div><div class="signal-metrics"><div><div class="tiny-label">VIBRATION RMS</div><div class="metric-value">' +
    (last ? last.vibrationRms.toFixed(2) : "--") +
    '<span class="metric-unit">m/s²</span></div><div class="metric-note">Dynamic acceleration</div></div><div><div class="tiny-label">TEMPERATURE</div><div class="metric-value">' +
    (last ? last.temperatureC.toFixed(1) : "--") +
    '<span class="metric-unit">°C</span></div><div class="metric-note">Contact sensor</div></div><div><div class="tiny-label">VS BASELINE</div><div class="metric-value">' +
    (last ? ratio.toFixed(1) : "--") +
    '<span class="metric-unit">×</span></div><div class="metric-note">' +
    (live ? "Illustrative baseline" : "Synthetic reference") +
    '</div></div></div><div class="plot-wrap"><div class="chart-top"><span class="chart-label">ACCELERATION / m/s²</span><span class="legend"><span><i></i>RMS</span><span><i class="dashed"></i>Threshold</span></span></div>' +
    chart(samples, d) +
    '</div><div class="chart-bottom"><span>' +
    samples.length +
    " SAMPLES · " +
    (live ? "API" : "SIMULATED 2s CADENCE") +
    '</span><div><button data-action="pause" ' +
    (live ? "disabled" : "") +
    ">" +
    (paused ? "▶ Resume" : "Ⅱ Pause") +
    '</button> &nbsp; / &nbsp; <button data-action="export">Export CSV</button></div></div></section>' +
    schematic() +
    "</div>" +
    (!live
      ? '<section class="scenario-bar"><div><h3>What happens when something changes?</h3><p>Inject a synthetic fault into ' +
        esc(d.name.toLowerCase()) +
        '.</p></div><div class="segments" aria-label="Fault simulation">' +
        [
          ["normal", "Normal"],
          ["rough", "High vibration"],
          ["hot", "Overheating"],
          ["offline", "Disconnect"],
        ]
          .map(
            ([a, n]) =>
              '<button class="segment ' +
              (scenarios[selected] === a ? "active" : "") +
              '" data-scenario="' +
              a +
              '">' +
              n +
              "</button>",
          )
          .join("") +
        "</div></section>"
      : "")
  );
}
function fleet() {
  return (
    '<section class="panel"><div class="panel-head"><div><p class="panel-kicker">FLEET AT A GLANCE</p><h2>Your equipment, in one place.</h2></div><span class="device-id">04 NODES</span></div><div class="table-scroll"><table class="fleet-table"><thead><tr><th>DEVICE</th><th>TEMP</th><th>VIBRATION</th><th>STATUS</th></tr></thead><tbody>' +
    DEVICES.map((d) => {
      const last = (data[d.id] || []).at(-1);
      return (
        '<tr class="' +
        (d.id === selected ? "selected" : "") +
        '"><td><button class="device-name-button" data-device="' +
        d.id +
        '">' +
        d.name +
        "</button><small>" +
        d.id +
        " / " +
        d.short +
        '</small></td><td class="value-cell">' +
        (last ? last.temperatureC.toFixed(1) + "°" : "--") +
        '</td><td class="value-cell">' +
        (last ? last.vibrationRms.toFixed(2) : "--") +
        "</td><td>" +
        pill(state(d)) +
        "</td></tr>"
      );
    }).join("") +
    "</tbody></table></div></section>"
  );
}
function actionCard() {
  const d = DEVICES.find((d) => state(d).status === "attention");
  return (
    '<aside class="panel action-card"><span class="tag">' +
    (d ? "INSPECTION SUGGESTED" : "SIGNAL CHECK") +
    "</span><h3>" +
    (d
      ? d.name + " is outside its usual range."
      : "Good signals start with a good baseline.") +
    "</h3><p>" +
    (d
      ? "Review the trend and check sensor mounting before drawing conclusions. An anomaly is a prompt to investigate, not a diagnosis."
      : "The demo uses synthetic baselines. Collect normal operating data from your own machine before choosing thresholds.") +
    "</p>" +
    button(
      d ? "Review maintenance" : "How it works",
      d ? "incidents" : "integration",
      "small",
    ) +
    "</aside>"
  );
}
function incidents() {
  const flagged = DEVICES.filter((d) => state(d).status !== "healthy");
  return (
    '<div class="incident-list">' +
    (flagged.length
      ? flagged
          .map((d) => {
            const s = state(d);
            return (
              '<article class="incident"><span class="incident-symbol">!</span><div class="incident-main"><div class="panel-kicker">' +
              d.id +
              " / " +
              d.location +
              "</div><h2>" +
              d.name +
              "</h2><p>" +
              esc(s.reason) +
              " " +
              (s.status === "offline"
                ? "Check power and connectivity."
                : "Inspect mounting and operating conditions. Stop equipment only through its approved procedure.") +
              '</p><div class="incident-actions"><button class="button small" data-device="' +
              d.id +
              '">Inspect readings</button><button class="button accent small" data-note="' +
              d.id +
              '">Log maintenance note</button></div></div>' +
              pill(s) +
              "</article>"
            );
          })
          .join("")
      : '<div class="empty-state"><h2>No sustained anomalies in this window.</h2><p>Try a fault scenario from Overview to explore the review process.</p></div>') +
    '</div><section class="panel guide-card record-list"><p class="panel-kicker">LOCAL MAINTENANCE LOG</p><h2>What did you find?</h2><p>Demo notes stay in this browser. Live-mode notes are not persisted here. Logging a note does not clear an active sensor condition.</p>' +
    (records.length
      ? records
          .slice()
          .reverse()
          .map(
            (r) =>
              '<div class="record">' +
              esc(r.note) +
              "<span>" +
              esc(r.deviceId) +
              " / " +
              esc(new Date(r.at).toLocaleString()) +
              " / SIMULATED</span></div>",
          )
          .join("")
      : "<p>No notes yet. Review a flagged device to add one.</p>") +
    "</section>"
  );
}
function integration() {
  return (
    '<div class="integration-grid"><section class="panel guide-card"><span class="number">01 / SENSE</span><h3>Start with a real signal.</h3><p>Reference node: an ESP32 using the Arduino framework, an ADXL345 accelerometer and a DS18B20 contact-temperature sensor. Sample acceleration, remove its mean (including stationary gravity) and calculate a windowed RMS feature on the device.</p><p class="danger-note">The firmware is a reference implementation. It has not been flashed or validated on physical hardware. Do not connect to mains circuits or bypass machine guards.</p></section><section class="panel guide-card"><span class="number">02 / TRANSMIT</span><h3>A small, authenticated packet.</h3><pre>POST /api/telemetry\nAuthorization: Bearer &lt;device-key&gt;\n{\n  \"deviceId\": \"BW-001\",\n  \"bootId\": \"session-001\",\n  \"sequence\": 1,\n  \"timestamp\": 1790899200000,\n  \"temperatureC\": 36.2,\n  \"vibrationRms\": 0.38\n}</pre><p>Use a current timestamp. The server checks device identity, bounds and replayed sequence numbers before saving a reading.</p></section><section class="panel guide-card"><span class="number">03 / UNDERSTAND</span><h3>Explainable rules, not black-box claims.</h3><ol><li>Flag temperature at or above 60°C for three consecutive samples.</li><li>Flag acceleration RMS at or above the greater of 1.2 m/s² or 2.5× the illustrative baseline, for three samples.</li><li>Flag missing packets after 30 seconds.</li></ol><p>These are demonstration thresholds, not manufacturer limits or an industrial vibration standard. No trained AI or predictive maintenance model is included.</p></section><section class="panel guide-card"><span class="number">04 / CONNECT</span><h3>Your data stays separate.</h3><p>The public demo is synthetic and runs entirely in your browser. Real readings require an operator key. Keys stay in memory for the current session and are never saved to browser storage.</p>' +
    button("Open live connection", "connect", "primary") +
    '<p class="source-note">Firmware, wiring, API specification, tests and deployment instructions are included in the project source.</p></section></div><section class="panel guide-card wide-panel"><p class="panel-kicker">REPRODUCIBLE LEARNING PATH</p><h3>One honest prototype. Room to grow.</h3><p>Build a low-voltage tabletop rig, collect a baseline, repeat controlled conditions, and compare observed alerts with the expected result. An Edge Impulse classifier is a possible next experiment after collecting labelled hardware data, not a capability claimed by this prototype. This is an independent project, not an official Arduino or Qualcomm product.</p></section>'
  );
}
function render() {
  const n = names[view];
  $("#page-crumb").textContent = n[0];
  $("#page-title").textContent = n[1];
  $("#page-subtitle").textContent = n[2];
  document.querySelector(".demo-mark").textContent = live
    ? "SENSOR API"
    : "DEMO LAB";
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#mode-label").textContent = live
    ? "PROTECTED SENSOR DATA"
    : "SIMULATED DATA";
  $("#demo-message").textContent = live
    ? "Private telemetry API. No demo readings are mixed into this view."
    : "Explore four simulated machines. No physical hardware is connected.";
  $("#reset-button").textContent = live ? "Return to demo" : "Reset demo ↻";
  $("#content").innerHTML =
    view === "overview"
      ? stats() +
        telemetry() +
        '<div class="bottom-grid">' +
        fleet() +
        actionCard() +
        '</div><p class="source-note">' +
        (live ? "API telemetry" : "Synthetic telemetry") +
        " · Rules-based detection · Not a trained AI model or validated industrial monitor</p>"
      : view === "devices"
        ? stats() +
          fleet() +
          '<p class="source-note">The fleet is a fixed four-node reference configuration. Names and locations are fictional.</p>'
        : view === "incidents"
          ? incidents()
          : integration();
}
function scenario(kind) {
  if (live) return;
  clock = Date.now();
  paused = false;
  scenarios[selected] = kind;
  const d = DEVICES.find((d) => d.id === selected),
    samples = data[selected];
  if (kind === "offline") {
    samples.forEach((s) => (s.timestamp -= 60000));
  } else {
    for (let i = 0; i < 4; i++)
      samples[samples.length - 4 + i] = {
        deviceId: selected,
        timestamp: clock - (3 - i) * 2000,
        temperatureC: kind === "hot" ? 72 + i * 0.2 : d.temp,
        vibrationRms: kind === "rough" ? 1.75 + i * 0.03 : d.baseline,
        sequence: ++tick,
        bootId: "demo",
      };
  }
  render();
  toast(
    kind === "offline"
      ? "Simulated packet loss. No hardware was disconnected."
      : "Scenario applied to " + d.name + ".",
  );
}
function connect() {
  modal(
    '<p class="panel-kicker">PROTECTED LIVE MODE</p><h2>Connect your telemetry API.</h2><p>Deploy the Worker, provision device keys and stream a sensor or clearly labelled test packet first. This view reads from the same deployment only.</p><form id="connect-form"><label for="operator-key">Operator key</label><input id="operator-key" name="operatorKey" type="password" required minlength="24" autocomplete="off" placeholder="Your deployed OPERATOR_KEY"><button class="button primary" type="submit">Connect securely</button><p id="connect-error" class="danger-note" hidden></p></form><p class="source-note">No key yet? Follow the repository setup guide. No account or device is created by this dialog.</p>',
  );
}
async function fetchFleet(key) {
  const r = await fetch("/api/fleet", {
    headers: { Authorization: "Bearer " + key },
    cache: "no-store",
  });
  const payload = await r.json();
  if (!r.ok) throw new Error(payload.error || "Connection failed.");
  return payload;
}
function reset() {
  live = false;
  token = "";
  paused = false;
  clock = Date.now();
  data = createDemo(clock);
  DEVICES.forEach(
    (d) => (scenarios[d.id] = d.id === "BW-002" ? "rough" : "normal"),
  );
  selected = "BW-002";
  render();
  toast("Simulation reset. Your maintenance notes were kept.");
}
document.addEventListener("click", (e) => {
  const v = e.target.closest("[data-view]");
  if (v) setView(v.dataset.view);
  const d = e.target.closest("button[data-device]");
  if (d) {
    selected = d.dataset.device;
    setView("overview");
  }
  const s = e.target.closest("[data-scenario]");
  if (s) scenario(s.dataset.scenario);
  const note = e.target.closest("[data-note]");
  if (note) {
    if (live) {
      toast("Live notes are not stored by this public prototype.");
      return;
    }
    modal(
      '<p class="panel-kicker">' +
        note.dataset.note +
        ' / MAINTENANCE</p><h2>Record what you found.</h2><form id="note-form" data-device="' +
        note.dataset.note +
        '"><label for="note-text">Inspection or maintenance note</label><textarea id="note-text" maxlength="600" required placeholder="e.g. Checked the mounting bracket. Retest planned."></textarea><button class="button primary" type="submit">Save local note</button></form><p class="source-note">Demo data only. Do not enter personal or sensitive information.</p>',
    );
  }
  const a = e.target.closest("[data-action]")?.dataset.action;
  if (a === "pause") {
    paused = !paused;
    if (!paused) {
      const delta = Date.now() - clock;
      Object.values(data).forEach((samples) =>
        samples.forEach((s) => (s.timestamp += delta)),
      );
      clock = Date.now();
    }
    render();
  }
  if (a === "export") {
    const csv = toCsv(selected, data[selected] || []),
      filename = selected + "-" + (live ? "sensor" : "simulated") + ".csv";
    modal(
      '<p class="panel-kicker">TELEMETRY EXPORT</p><h2>Your readings, with context.</h2><p>' +
        esc(filename) +
        " / " +
        (data[selected] || []).length +
        ' samples. Every row includes a source label.</p><label for="csv-preview">CSV preview - select and copy if downloads are unavailable</label><textarea id="csv-preview" rows="8" readonly spellcheck="false">' +
        esc(csv) +
        '</textarea><a class="button primary" download="' +
        filename +
        '" href="data:text/csv;charset=utf-8,' +
        encodeURIComponent(csv) +
        '">Download CSV</a>',
    );
  }
  if (a === "incidents" || a === "integration") setView(a);
  if (a === "connect") connect();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "device-select") {
    selected = e.target.value;
    render();
  }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id === "note-form") {
    e.preventDefault();
    const note = $("#note-text").value.trim();
    if (!note) return;
    records.push({ deviceId: e.target.dataset.device, note, at: Date.now() });
    records = records.slice(-50);
    try {
      localStorage.setItem("benchwatch-demo-notes", JSON.stringify(records));
      toast("Maintenance note saved in this browser.");
    } catch {
      toast("Note added for this session; browser storage is unavailable.");
    }
    $("#modal").close();
    render();
  }
  if (e.target.id === "connect-form") {
    e.preventDefault();
    const key = $("#operator-key").value.trim();
    const b = e.target.querySelector("button");
    b.disabled = true;
    try {
      const p = await fetchFleet(key);
      data = p.series;
      token = key;
      live = true;
      paused = false;
      $("#modal").close();
      setView("overview");
      toast("Connected to protected telemetry.");
    } catch (err) {
      $("#connect-error").hidden = false;
      $("#connect-error").textContent = err.message;
    } finally {
      b.disabled = false;
    }
  }
});
$("#connect-button").onclick = connect;
$("#reset-button").onclick = reset;
$(".modal-close").onclick = () => $("#modal").close();
$("#about-button").onclick = () =>
  modal(
    '<p class="panel-kicker">INDEPENDENT PROOF OF WORK</p><h2>BenchWatch, by Arun Chandel.</h2><p>A reproducible experiment in equipment telemetry: device-side feature extraction, authenticated ingestion, trend inspection and maintenance notes.</p><p>All initial readings, equipment names and locations are fictional. The web interface and API can be tested without hardware. Sensor accuracy, physical wiring and real-world fault detection still require hardware validation.</p><p>Not affiliated with or endorsed by Arduino, Qualcomm or Edge Impulse. This prototype does not control machinery.</p>',
  );
function refreshValues() {
  if (!["overview", "devices"].includes(view)) return;
  const fresh = document.createElement("div");
  fresh.innerHTML =
    stats() + (view === "overview" ? telemetry() : "") + fleet();
  for (const selector of [
    ".stats",
    ".signal-metrics",
    ".plot-wrap",
    ".main-grid .panel-head .pill",
  ]) {
    const current = document.querySelector(selector),
      replacement = fresh.querySelector(selector);
    if (current && replacement) current.innerHTML = replacement.innerHTML;
    if (current && replacement && selector.endsWith(".pill"))
      current.className = replacement.className;
  }
  const currentRows = document.querySelectorAll(".fleet-table tbody tr"),
    newRows = fresh.querySelectorAll(".fleet-table tbody tr");
  currentRows.forEach((row, i) => {
    for (let col = 1; col < 4; col++)
      row.children[col].innerHTML = newRows[i].children[col].innerHTML;
  });
}
setInterval(async () => {
  if (live) {
    if (pollBusy) return;
    pollBusy = true;
    try {
      data = (await fetchFleet(token)).series;
      refreshValues();
    } catch {
      toast("Sensor API unavailable. Showing last received data.");
      refreshValues();
    } finally {
      pollBusy = false;
    }
    return;
  }
  if (paused) return;
  clock = Date.now();
  tick++;
  DEVICES.forEach((d, j) => {
    const kind = scenarios[d.id];
    if (kind === "offline") return;
    const base = kind === "rough" ? 1.75 : d.baseline,
      temp = kind === "hot" ? 73 : d.temp;
    data[d.id].push({
      deviceId: d.id,
      timestamp: clock,
      temperatureC: +(temp + Math.sin(tick / 8 + j)).toFixed(1),
      vibrationRms: +Math.max(
        0,
        base + Math.sin(tick * 1.7 + j) * 0.07 + Math.cos(tick * 0.8) * 0.04,
      ).toFixed(3),
      sequence: tick,
      bootId: "demo",
    });
    data[d.id] = data[d.id].slice(-90);
  });
  refreshValues();
}, 2000);
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1);
  if (names[next]) setView(next);
});
view = names[location.hash.slice(1)] ? location.hash.slice(1) : "overview";
render();
