#!/usr/bin/env node
// Runtime checks for the listing's highest-value interactions and motion gate.

const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:8088/", { waitUntil: "networkidle" });

  if (await page.locator("h1").count() !== 1) throw new Error("expected exactly one h1");
  if (await page.locator("#gallery img[loading=lazy]").count() !== 15) throw new Error("gallery lazy-loading count mismatch");
  console.log("PASS: semantic h1 and 15 lazy gallery images");

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2));
  await page.waitForTimeout(450);
  if (!await page.locator("#stickyCta").evaluate((element) => element.classList.contains("visible"))) {
    throw new Error("sticky mobile CTA did not appear after hero exit");
  }
  console.log("PASS: sticky mobile CTA appears after hero exits");

  await page.locator("#gallery").scrollIntoViewIfNeeded();
  await page.locator(".glightbox").first().click();
  await page.locator(".glightbox-container").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.locator(".glightbox-container").waitFor({ state: "hidden" });
  console.log("PASS: GLightbox opens and closes by keyboard");

  await page.locator("#feedback").scrollIntoViewIfNeeded();
  await page.locator("#fb-name").fill("Test Visitor");
  await page.locator("#fb-email").fill("test@example.com");
  await page.locator("#fb-interest").selectOption({ label: "Requesting a showing" });
  await page.locator("#feedbackForm button").click();
  if (!(await page.locator("#formStatus").textContent()).includes("setup is pending")) {
    throw new Error("placeholder Formspree endpoint was not safely intercepted");
  }
  console.log("PASS: placeholder form is structurally wired and safely intercepted");

  if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
  await context.close();

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto("http://127.0.0.1:8088/", { waitUntil: "domcontentloaded" });
  const reduced = await reducedPage.evaluate(() => ({
    revealOpacity: getComputedStyle(document.querySelector(".reveal")).opacity,
    heroAnimationDuration: getComputedStyle(document.querySelector(".hero-media img")).animationDuration,
    waterlineAnimationDuration: getComputedStyle(document.querySelector(".hero + .section"), "::before").animationDuration,
  }));
  const heroSeconds = Number.parseFloat(reduced.heroAnimationDuration);
  const waterlineSeconds = Number.parseFloat(reduced.waterlineAnimationDuration);
  if (reduced.revealOpacity !== "1" || heroSeconds > 0.00001 || waterlineSeconds > 0.00001) {
    throw new Error(`reduced-motion gate failed: ${JSON.stringify(reduced)}`);
  }
  console.log(`PASS: reduced-motion gate ${JSON.stringify(reduced)}`);
  await reducedContext.close();
  await browser.close();
  console.log("VERDICT: PASS");
})().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
