import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/tmp/shots";

const pages = process.argv[2]
  ? process.argv[2].split(",").map((p) => ({ path: p, name: p.replace(/[^a-z0-9]/gi, "_") || "home" }))
  : [
      { path: "/", name: "dashboard" },
      { path: "/people", name: "people" },
      { path: "/tree", name: "tree" },
      { path: "/mindmap", name: "mindmap" },
      { path: "/timeline", name: "timeline" },
      { path: "/stats", name: "stats" },
      { path: "/generations", name: "generations" },
      { path: "/fan-chart", name: "fanchart" },
      { path: "/relationship", name: "relationship" },
      { path: "/settings", name: "settings" },
      { path: "/admin/imports", name: "imports" },
      { path: "/admin/data-quality", name: "dataquality" },
      { path: "/admin/settings", name: "usermgmt" },
    ];

const width = process.env.W ? parseInt(process.env.W) : 1440;
const height = process.env.H ? parseInt(process.env.H) : 900;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

// Login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "sam@loyd.family");
await page.fill('input[type="password"]', "Password1!");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

for (const p of pages) {
  errors.length = 0;
  try {
    await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1800);
    const suffix = process.env.SUFFIX || "";
    await page.screenshot({ path: `${OUT}/${p.name}${suffix}.png`, fullPage: process.env.FULL === "1" });
    console.log(`✓ ${p.path} -> ${p.name}${suffix}.png ${errors.length ? "ERRORS: " + errors.join(" | ") : ""}`);
  } catch (e) {
    console.log(`✗ ${p.path} FAILED: ${e.message} ${errors.join(" | ")}`);
  }
}

await browser.close();
