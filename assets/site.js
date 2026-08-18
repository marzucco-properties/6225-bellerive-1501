(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.getElementById("hero");
  var stickyCta = document.getElementById("stickyCta");

  function trackAnalyticsEvent(eventName) {
    var payload = {
      event: eventName,
      path: window.location.pathname,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString()
    };

    // INERT: enable only after the first-party Cloudflare Worker is deployed.
    // fetch("https://analytics.marzuccoselite.com/e", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
    void payload;
  }

  document.addEventListener("click", function (event) {
    var target = event.target.closest("a[data-analytics-event], button[data-analytics-event]");
    if (target) trackAnalyticsEvent(target.dataset.analyticsEvent);
  });

  if ("IntersectionObserver" in window && hero && stickyCta) {
    new IntersectionObserver(function (entries) {
      stickyCta.classList.toggle("visible", !entries[0].isIntersecting);
    }, { threshold: 0.05 }).observe(hero);
  }

  var revealItems = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (!reduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("reveal-ready");
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.revealTarget.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealItems.forEach(function (item) {
      var trigger = item.querySelector(".eyebrow") || item;
      trigger.revealTarget = item;
      revealObserver.observe(trigger);
    });
  }

  var lightbox = GLightbox({
    selector: ".glightbox",
    touchNavigation: true,
    loop: true,
    zoomable: true,
    keyboardNavigation: true,
    openEffect: reduceMotion ? "none" : "fade",
    closeEffect: reduceMotion ? "none" : "fade"
  });

  lightbox.on("open", function () {
    var gallery = document.querySelector(".gallery[data-analytics-event]");
    if (gallery) trackAnalyticsEvent(gallery.dataset.analyticsEvent);
  });

  var scrollEventFired = false;
  window.addEventListener("scroll", function () {
    if (scrollEventFired) return;
    var pageHeight = document.documentElement.scrollHeight;
    var depth = (window.scrollY + window.innerHeight) / pageHeight;
    if (depth >= 0.75) {
      scrollEventFired = true;
      if (document.body.dataset.analyticsScrollEvent) {
        trackAnalyticsEvent(document.body.dataset.analyticsScrollEvent);
      }
    }
  }, { passive: true });

})();
