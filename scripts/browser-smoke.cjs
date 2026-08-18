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
  const consoleErrors = [];
  const thirdPartyRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) thirdPartyRequests.push(request.url());
  });
  await page.goto("http://127.0.0.1:8088/", { waitUntil: "networkidle" });

  const fontProof = await page.evaluate(async () => {
    await document.fonts.ready;
    const hero = getComputedStyle(document.querySelector("h1"));
    const body = getComputedStyle(document.body);
    const loadedFaces = Array.from(document.fonts)
      .filter((face) => ["Marcellus", "Mulish"].includes(face.family))
      .map((face) => `${face.family}:${face.weight}:${face.status}`);
    return {
      marcellus400: document.fonts.check('400 32px "Marcellus"', "Bellerive"),
      mulish400: document.fonts.check('400 16px "Mulish"', "Bellerive"),
      mulish600: document.fonts.check('600 16px "Mulish"', "Bellerive"),
      heroFamily: hero.fontFamily,
      bodyFamily: body.fontFamily,
      loadedFaces,
      fontResources: performance.getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => url.endsWith(".woff2")),
    };
  });
  if (!fontProof.marcellus400 || !fontProof.mulish400 || !fontProof.mulish600 ||
      !fontProof.heroFamily.startsWith("Marcellus") || !fontProof.bodyFamily.startsWith("Mulish") ||
      !fontProof.loadedFaces.includes("Marcellus:400:loaded") ||
      !fontProof.loadedFaces.includes("Mulish:400:loaded") ||
      !fontProof.loadedFaces.includes("Mulish:600:loaded") ||
      !fontProof.fontResources.some((url) => url.includes("/assets/fonts/marcellus/")) ||
      !fontProof.fontResources.some((url) => url.includes("/assets/fonts/mulish/mulish-400-")) ||
      !fontProof.fontResources.some((url) => url.includes("/assets/fonts/mulish/mulish-600-")) ||
      fontProof.fontResources.some((url) => new URL(url).origin !== "http://127.0.0.1:8088")) {
    throw new Error(`self-hosted font gate failed: ${JSON.stringify(fontProof)}`);
  }
  console.log(`PASS: self-hosted fonts loaded and applied ${JSON.stringify(fontProof)}`);

  if (await page.locator("h1").count() !== 1) throw new Error("expected exactly one h1");
  if (await page.locator("#gallery img[loading=lazy]").count() !== 15) throw new Error("gallery lazy-loading count mismatch");
  console.log("PASS: semantic h1 and 15 lazy gallery images");

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.2));
  await page.waitForTimeout(450);
  if (!await page.locator("#stickyCta").evaluate((element) => element.classList.contains("visible"))) {
    throw new Error("sticky mobile CTA did not appear after hero exit");
  }
  console.log("PASS: sticky mobile CTA appears after hero exits");
  const navProof = await page.locator(".site-nav").evaluate((element) => ({
    condensed: element.classList.contains("is-condensed"),
    position: getComputedStyle(element).position,
    backdropFilter: getComputedStyle(element).backdropFilter,
  }));
  if (!navProof.condensed || navProof.position !== "fixed" || !navProof.backdropFilter.includes("blur")) {
    throw new Error(`condensed navigation gate failed: ${JSON.stringify(navProof)}`);
  }
  console.log(`PASS: fixed condensed glass navigation ${JSON.stringify(navProof)}`);

  await page.locator("#gallery").scrollIntoViewIfNeeded();
  await page.locator(".glightbox").first().click();
  await page.locator(".glightbox-container").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.locator(".glightbox-container").waitFor({ state: "hidden" });
  console.log("PASS: GLightbox opens and closes by keyboard");

  const formState = await page.locator("#feedbackForm").evaluate((form) => ({
    action: form.getAttribute("action"),
    submitDisabled: form.querySelector('button[type="submit"]').disabled,
  }));
  if (formState.action !== "" || !formState.submitDisabled) throw new Error(`feedback form is not inert: ${JSON.stringify(formState)}`);
  console.log("PASS: feedback form keeps empty action and disabled submit");

  if (thirdPartyRequests.length) throw new Error(`third-party requests: ${thirdPartyRequests.join(" | ")}`);
  console.log("PASS: zero third-party network requests");

  if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
  if (consoleErrors.length) throw new Error(`console errors: ${consoleErrors.join(" | ")}`);
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
    navTransitionDuration: getComputedStyle(document.querySelector(".site-nav")).transitionDuration,
    galleryTransitionDuration: getComputedStyle(document.querySelector(".gallery-item img")).transitionDuration,
  }));
  const heroSeconds = Number.parseFloat(reduced.heroAnimationDuration);
  const waterlineSeconds = Number.parseFloat(reduced.waterlineAnimationDuration);
  const navSeconds = Number.parseFloat(reduced.navTransitionDuration);
  const gallerySeconds = Number.parseFloat(reduced.galleryTransitionDuration);
  if (reduced.revealOpacity !== "1" || heroSeconds > 0.00001 || waterlineSeconds > 0.00001 || navSeconds > 0.00001 || gallerySeconds > 0.00001) {
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
