/* Marco Lattarulo — portfolio interactions (vanilla, no dependencies)
   - light/dark theme toggle (persisted)
   - language choice memory (for the "/" redirect) + language dropdown
   - mobile nav toggle
   - lazy image fade-in
   - sticky-nav shadow + back-to-top button
   - zoom viewer on the artwork page (pan by drag / drag-scroll)
*/
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme ---------- */
  try {
    var saved = localStorage.getItem("ml-theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) {}

  function currentTheme() {
    var attr = root.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateThemeIcon() {
    var isDark = currentTheme() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.textContent = isDark ? "☀" : "☾";
      b.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    });
  }
  updateThemeIcon();

  /* ---------- Delegated clicks ---------- */
  document.addEventListener("click", function (e) {
    var themeBtn = e.target.closest("[data-theme-toggle]");
    if (themeBtn) {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("ml-theme", next); } catch (err) {}
      updateThemeIcon();
      return;
    }

    var navBtn = e.target.closest("[data-nav-toggle]");
    if (navBtn) {
      var nav = document.querySelector(".nav-inner");
      if (nav) {
        var open = nav.classList.toggle("open");
        navBtn.setAttribute("aria-expanded", open ? "true" : "false");
      }
      return;
    }

    var toTop = e.target.closest("[data-to-top]");
    if (toTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    var lang = e.target.closest(".lang-link");
    if (lang) {
      try { localStorage.setItem("ml-lang", lang.getAttribute("lang")); } catch (err) {}
      return;
    }

    var langBtn = e.target.closest(".lang-current");
    if (langBtn) {
      var sw = langBtn.parentNode;
      var openNow = sw.classList.toggle("is-open");
      langBtn.setAttribute("aria-expanded", openNow ? "true" : "false");
      return;
    }
    closeLangMenus();
  });

  /* ---------- Language dropdown (hover is handled in CSS) ---------- */
  function closeLangMenus() {
    document.querySelectorAll("[data-lang-switch].is-open").forEach(function (sw) {
      sw.classList.remove("is-open");
      sw.querySelector(".lang-current").setAttribute("aria-expanded", "false");
    });
  }
  document.querySelectorAll("[data-lang-switch]").forEach(function (sw) {
    sw.addEventListener("mouseleave", function () {
      if (window.matchMedia("(hover: hover)").matches) closeLangMenus();
    });
    sw.addEventListener("focusout", function (ev) {
      if (!sw.contains(ev.relatedTarget)) closeLangMenus();
    });
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeLangMenus();
  });

  /* ---------- Lazy fade-in ---------- */
  var lazies = [].slice.call(document.querySelectorAll("img[loading='lazy']"));
  lazies.forEach(function (img) { if (!img.complete) img.classList.add("img-in"); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        function reveal() { img.classList.remove("img-in"); }
        if (img.complete) reveal();
        else img.addEventListener("load", reveal, { once: true });
        io.unobserve(img);
      });
    }, { rootMargin: "300px" });
    lazies.forEach(function (img) { io.observe(img); });
  } else {
    lazies.forEach(function (img) { img.classList.remove("img-in"); });
  }

  /* ---------- Nav shadow + back-to-top ---------- */
  var nav = document.querySelector(".site-nav");
  var toTopBtn = document.querySelector("[data-to-top]");
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (nav) {
      nav.classList.toggle("is-stuck", y > 8);
      nav.classList.toggle("is-scrolled", y > 70);
    }
    if (toTopBtn) toTopBtn.hidden = y < 600;
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Artwork zoom viewer ---------- */
  var zoomBtn = document.querySelector(".work-zoom");
  if (!zoomBtn) return;

  var overlay = null;

  function openZoom() {
    var srcFull = zoomBtn.getAttribute("data-zoom-src");
    overlay = document.createElement("div");
    overlay.className = "zoom-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<button class="zoom-close" aria-label="Close">✕</button>' +
      '<div class="zoom-stage"><img alt=""></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    var stage = overlay.querySelector(".zoom-stage");
    var img = overlay.querySelector("img");
    img.src = srcFull;
    var pageImg = zoomBtn.querySelector("img");
    img.alt = pageImg ? pageImg.alt : "";

    var zoomed = false;
    function toggleZoom(ev) {
      zoomed = !zoomed;
      stage.classList.toggle("is-zoomed", zoomed);
      if (zoomed && ev) {
        var r = img.getBoundingClientRect();
        stage.scrollLeft = (ev.clientX - r.left) / r.width * stage.scrollWidth - stage.clientWidth / 2;
        stage.scrollTop = (ev.clientY - r.top) / r.height * stage.scrollHeight - stage.clientHeight / 2;
      }
    }
    img.addEventListener("click", toggleZoom);

    // drag to pan when zoomed
    var down = false, sx = 0, sy = 0, ol = 0, ot = 0;
    stage.addEventListener("pointerdown", function (ev) {
      if (!zoomed) return;
      down = true; sx = ev.clientX; sy = ev.clientY;
      ol = stage.scrollLeft; ot = stage.scrollTop;
      stage.setPointerCapture(ev.pointerId);
    });
    stage.addEventListener("pointermove", function (ev) {
      if (!down) return;
      stage.scrollLeft = ol - (ev.clientX - sx);
      stage.scrollTop = ot - (ev.clientY - sy);
    });
    stage.addEventListener("pointerup", function () { down = false; });

    overlay.querySelector(".zoom-close").addEventListener("click", closeZoom);
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) closeZoom();
    });
    document.addEventListener("keydown", onKey);
    overlay.querySelector(".zoom-close").focus();
  }

  function onKey(ev) {
    if (ev.key === "Escape") closeZoom();
  }

  function closeZoom() {
    if (!overlay) return;
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    overlay = null;
    document.body.style.overflow = "";
    zoomBtn.focus();
  }

  zoomBtn.addEventListener("click", openZoom);
})();
