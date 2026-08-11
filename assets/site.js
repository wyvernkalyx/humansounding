// HumanSounding shared shell script: theme, mobile nav, analytics, live data.
// Everything runs client-side; drafts and page text are never transmitted.

// ---- theme (set early by the inline snippet in each page's <head>; this wires the toggle) ----
function hsSetTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("hs_theme", t); } catch { /* storage blocked */ }
}
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("themeBtn");
  if (btn) btn.addEventListener("click", () => {
    hsSetTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  // mobile "More" dropdown
  const more = document.querySelector("#topnav .morebtn");
  const menu = document.querySelector("#topnav .menu");
  if (more && menu) {
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle("open");
      more.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", () => { menu.classList.remove("open"); more.setAttribute("aria-expanded", "false"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu.classList.remove("open"); more.setAttribute("aria-expanded", "false"); } });
  }
});

// ---- analytics (aggregate-only; no text, no IPs stored) ----
const TRACK_URL = "https://mrkvxxmzekasxtpscawj.supabase.co/functions/v1/track";
const TRACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ya3Z4eG16ZWthc3h0cHNjYXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzY3ODIsImV4cCI6MjEwMTk1Mjc4Mn0.NCDkRv2KxJge8mvXZ_fGrfwocJA8VOx93-P7FGsLI04";
async function ping(payload) {
  try {
    const r = await fetch(TRACK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + TRACK_KEY },
      body: JSON.stringify(payload || {})
    });
    return await r.json();
  } catch { return null; }
}
(async () => {
  // A "visit" = first pageload in a rolling 30-minute window for this browser,
  // shared across tabs and surviving refreshes (localStorage timestamp only).
  let isNew = true;
  try {
    const now = Date.now();
    const last = Number(localStorage.getItem("hs_last")) || 0;
    isNew = now - last > 30 * 60 * 1000;
    localStorage.setItem("hs_last", String(now));
  } catch { /* storage blocked: count conservatively as a repeat, not a new visit */ isNew = false; }
  const res = await ping({ new_session: isNew, ref: document.referrer || "" });
  if (res && typeof res.sessions === "number") {
    const el = document.getElementById("meterN");
    if (el) { el.textContent = res.sessions.toLocaleString(); const m = document.getElementById("meter"); if (m) m.hidden = false; }
  }
})();

// ---- live site data (Supabase; every consumer must render embedded fallback first) ----
const escHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function fetchSiteData() {
  try {
    const r = await fetch(TRACK_URL + "?what=data", { headers: { "authorization": "Bearer " + TRACK_KEY } });
    const j = await r.json();
    if (j && j.data && Array.isArray(j.data.trends)) return j.data;
  } catch { /* fallback already rendered */ }
  return null;
}

// download helper for the portable instructions (embedded in the page as text/plain)
function dl(name, srcId) {
  const text = document.getElementById(srcId).textContent.trim() + "\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  ping({ event: "dl_portable" });
}
