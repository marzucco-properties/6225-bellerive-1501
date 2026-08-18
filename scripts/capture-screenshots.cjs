#!/usr/bin/env node
// Capture four full-page evidence screenshots after triggering scroll reveals.

const path = require("path");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const cases = [
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
    await page.goto("http://127.0.0.1:8088/", { waitUntil: "networkidle" });
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
      path: path.join(root, "evidence", `screenshot-${item.name}.png`),
      fullPage: true,
    });
    await page.close();
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
