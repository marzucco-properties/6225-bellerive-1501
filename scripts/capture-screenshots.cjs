#!/usr/bin/env node
// Capture four full-page evidence screenshots after triggering scroll reveals.

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const evidenceDir = process.env.EVIDENCE_DIR || path.join(root, "evidence");
const siteUrl = process.env.SITE_URL || "http://127.0.0.1:8088/";
const requestedViewports = new Set((process.env.VIEWPORTS || "360,390,768,1280").split(","));
const cases = [
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
].filter((item) => requestedViewports.has(item.name));

(async () => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${message.text()} (${message.location().url})`);
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(siteUrl, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.documentElement.style.scrollBehavior = "auto";
      const step = Math.max(320, Math.floor(window.innerHeight * 0.7));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      window.scrollTo(0, 0);
      await Promise.all(Array.from(document.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }));
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await page.screenshot({
      path: path.join(evidenceDir, `screenshot-${item.name}.png`),
      fullPage: true,
    });
    await page.evaluate(() => {
      const card = document.querySelector(".agent-card");
      const navHeight = document.querySelector(".site-nav").getBoundingClientRect().height;
      window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - navHeight - 18);
    });
    await page.waitForTimeout(500);
    const navCondensed = await page.locator(".site-nav").evaluate((element) => element.classList.contains("is-condensed"));
    if (!navCondensed) throw new Error(`${item.name}px condensed navigation state did not activate`);
    await page.screenshot({
      path: path.join(evidenceDir, `screenshot-${item.name}-contact-nav-scrolled.png`),
    });
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (hasHorizontalOverflow || consoleErrors.length || pageErrors.length) {
      throw new Error(`${item.name}px render failed: overflow=${hasHorizontalOverflow} console=${consoleErrors.join(" | ")} page=${pageErrors.join(" | ")}`);
    }
    console.log(`PASS: ${item.name}px render; no horizontal overflow, console errors, or page errors`);
    await page.close();
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
