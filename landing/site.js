/* =========================================================================
   Bussola landing — shared behaviour.
   No dependencies. Every enhancement is progressive: the pages are complete
   and readable with this file blocked.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- theme -----------------------------------------------------------
     Cycles system → light → dark. "system" removes the attribute so the
     `color-scheme: light dark` default in styles.css takes over again.
     The stored value is applied by an inline snippet in <head> (before
     paint) so there is no flash; this only wires the button.            */
  var root = document.documentElement;
  var THEMES = ["light", "dark"];

  function label(theme) {
    if (!theme) return "Theme: follows your system. Switch to light";
    return theme === "light"
      ? "Theme: light. Switch to dark"
      : "Theme: dark. Switch to system";
  }

  function apply(theme) {
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
    try {
      if (theme) localStorage.setItem("bussola-theme", theme);
      else localStorage.removeItem("bussola-theme");
    } catch (_) {
      /* private mode — the toggle still works for this page view */
    }
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-label", label(theme));
      btn.setAttribute("title", label(theme));
    });
  }

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var current = root.getAttribute("data-theme");
      var next = THEMES[THEMES.indexOf(current) + 1];
      apply(current && !next ? null : next || THEMES[0]);
    });
  });
  apply(root.getAttribute("data-theme"));

  /* ---- mobile nav ------------------------------------------------------ */
  var nav = document.getElementById("nav");
  var navToggle = document.querySelector(".nav-toggle");
  if (nav && navToggle) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  /* ---- header shadow on scroll ----------------------------------------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---- current year ---------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---- scroll reveal ---------------------------------------------------
     The hidden state lives behind .js-anim on <html>, which the boot script
     only sets when it can be undone. Dropping the class here reveals every
     section at once, so no path through this code can leave the page blank. */
  var reveals = document.querySelectorAll(".reveal");
  var showAll = function () {
    root.classList.remove("js-anim");
  };

  if (!reveals.length || !root.classList.contains("js-anim")) {
    showAll();
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });

    /* Safety net: a tab that never composits (background, print, an engine
       that withholds the callback) would otherwise hold the page at zero
       opacity. Reveal unconditionally if nothing has fired by then. */
    setTimeout(function () {
      if (!document.querySelector(".reveal.is-in")) showAll();
    }, 2500);
  }

  /* ---- pricing interval switch ----------------------------------------- */
  var billing = document.querySelector("[data-billing-switch]");
  if (billing) {
    billing.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-interval]");
      if (!btn) return;
      var interval = btn.dataset.interval;
      billing.querySelectorAll("button[data-interval]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      document.querySelectorAll("[data-price]").forEach(function (el) {
        var value = el.dataset[interval];
        if (value !== undefined) el.textContent = value;
      });
      document.querySelectorAll("[data-note]").forEach(function (el) {
        var value = el.dataset[interval];
        if (value !== undefined) el.textContent = value;
      });
    });
  }

  /* ---- widget catalog filter ------------------------------------------- */
  var filters = document.querySelector("[data-filters]");
  var catalog = document.querySelector("[data-catalog]");
  if (filters && catalog) {
    var empty = document.querySelector("[data-catalog-empty]");
    var counter = document.querySelector("[data-catalog-count]");

    filters.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-source]");
      if (!btn) return;
      var source = btn.dataset.source;

      filters.querySelectorAll("button[data-source]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });

      var shown = 0;
      catalog.querySelectorAll("[data-item-source]").forEach(function (item) {
        var match = source === "all" || item.dataset.itemSource === source;
        item.hidden = !match;
        if (match) shown++;
      });

      if (empty) empty.hidden = shown !== 0;
      if (counter) counter.textContent = String(shown);
    });
  }
})();
