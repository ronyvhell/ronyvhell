// Genera dist/activity-dark.svg y dist/activity-light.svg con las contribuciones de los últimos 31 días.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DAYS = 31;
const login = process.env.GH_USER;
const outDir = process.env.OUT_DIR || "dist";

async function fetchDays() {
  if (process.env.DATA_FILE) return JSON.parse(readFileSync(process.env.DATA_FILE, "utf8"));
  const to = new Date();
  const from = new Date(to.getTime() - (DAYS - 1) * 86400000);
  const query = `query($login:String!,$from:DateTime!,$to:DateTime!){
    user(login:$login){contributionsCollection(from:$from,to:$to){
      contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login, from: from.toISOString(), to: to.toISOString() } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
  return json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }))
    .slice(-DAYS);
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const label = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m - 1]}`; };

const THEMES = {
  dark: { text: "#e6edf3", muted: "#8b949e", faint: "#30363d", accent: "#f85149" },
  light: { text: "#1f2328", muted: "#59636e", faint: "#d1d9e0", accent: "#cf222e" },
};

function render(days, t) {
  const W = 820, H = 260, L = 44, R = 16, T = 48, B = 34;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(4, ...days.map((d) => d.count));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const x = (i) => L + (i * pw) / (days.length - 1);
  const y = (v) => T + ph - (v * ph) / top;
  const pts = days.map((d, i) => [x(i).toFixed(1), y(d.count).toFixed(1)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");
  const area = `${line}L${x(days.length - 1).toFixed(1)},${T + ph}L${L},${T + ph}Z`;
  const total = days.reduce((s, d) => s + d.count, 0);
  const grid = [0, 1, 2, 3, 4].map((k) => {
    const v = k * step, yy = y(v).toFixed(1);
    return `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${t.faint}" stroke-dasharray="${k ? "3 4" : "0"}"/>` +
      `<text x="${L - 10}" y="${yy}" text-anchor="end" dominant-baseline="middle" class="m">${v}</text>`;
  }).join("");
  const ticks = days.map((d, i) => (i % 5 === 0 || i === days.length - 1)
    ? `<text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="${i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}" class="m">${label(d.date)}</text>` : "").join("");
  const dots = days.map((d, i) => `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="${d.count ? 3 : 2}" fill="${d.count ? t.accent : t.muted}"><title>${label(d.date)}: ${d.count}</title></circle>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribuciones de los últimos ${DAYS} días: ${total}">
<style>text{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;font-size:11px;fill:${t.text}}.m{fill:${t.muted}}.h{font-size:14px;font-weight:700}</style>
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity=".35"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient></defs>
<text x="${L}" y="22" class="h">actividad · últimos ${DAYS} días</text>
<text x="${W - R}" y="22" text-anchor="end" class="m">${total} contribuciones</text>
${grid}
<path d="${area}" fill="url(#g)"/>
<path d="${line}" fill="none" stroke="${t.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
${dots}
${ticks}
</svg>
`;
}

const days = await fetchDays();
mkdirSync(outDir, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) writeFileSync(`${outDir}/activity-${name}.svg`, render(days, theme));
console.log(`OK: ${days.length} días, ${days.reduce((s, d) => s + d.count, 0)} contribuciones`);
