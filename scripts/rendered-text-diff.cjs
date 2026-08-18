#!/usr/bin/env node
// Compare actual browser-rendered innerText for frozen content across two builds.

const crypto = require("crypto");
const { chromium } = require("playwright-core");

const beforeUrl = process.argv[2] || "http://127.0.0.1:8089/";
const afterUrl = process.argv[3] || "http://127.0.0.1:8088/";
const selectors = ["#included", "#details", "#terms", "footer"];
const contactFacts = [
  "DeShawn Robinson",
  "Aimee Rodriguez",
  "(239) 776-5194",
  "(239) 238-6358",
  "dluxnaples@gmail.com",
  "400 5th Ave S, Suite 305, Naples, FL 34102",
];
const iconGlyphs = ["🌊", "✨", "🏊", "📶", "🚪", "🔒", "⛳", "🧺", "🛡", "✉", "📍", "🏠", "📞", "️"];

function normalize(value) {
  for (const glyph of iconGlyphs) value = value.split(glyph).join("");
  return value.replace(/\s+/g, " ").trim();
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const captures = {};
  for (const [label, url] of [["before", beforeUrl], ["after", afterUrl]]) {
    await page.goto(url, { waitUntil: "networkidle" });
    captures[label] = {};
    for (const selector of selectors) {
      captures[label][selector] = normalize(await page.locator(selector).innerText());
    }
    captures[label].contact = normalize(await page.locator("#contact").innerText());
  }
  await browser.close();

  for (const selector of selectors) {
    const before = captures.before[selector];
    const after = captures.after[selector];
    console.log(`${selector}\tbefore_bytes=${Buffer.byteLength(before)}\tafter_bytes=${Buffer.byteLength(after)}\tbefore_sha256=${hash(before)}\tafter_sha256=${hash(after)}`);
    if (before !== after) {
      console.error(`FAIL: rendered protected text differs for ${selector}`);
      process.exit(1);
    }
    console.log(`PASS: rendered protected text unchanged for ${selector}`);
  }
  for (const fact of contactFacts) {
    if (!captures.before.contact.includes(fact) || !captures.after.contact.includes(fact)) {
      console.error(`FAIL: protected contact fact missing: ${fact}`);
      process.exit(1);
    }
    console.log(`PASS: protected contact fact retained: ${fact}`);
  }
  console.log("VERDICT: PASS — protected disclosure/detail text unchanged and protected contact facts retained");
})().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
