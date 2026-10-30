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

  /* ---------- Fullscreen artwork viewer ---------- */
  // Gallery tiles open the viewer in place (arrows, swipe, Esc); on a work page
  // the zoom button opens it and neighbouring works are fetched on demand.
  var zoomBtn = document.querySelector(".work-zoom");
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".gallery .tile > a"));
  if (!zoomBtn && !tiles.length) return;

  var overlay = null, opener = null, provider = null, index = 0, current = null;
  var lang = document.documentElement.lang || "en";
  var L = { prev: "Previous", next: "Next", close: "Close", details: "Details" };
  if (lang === "it") L = { prev: "Precedente", next: "Successiva", close: "Chiudi", details: "Dettagli" };
  if (lang === "es") L = { prev: "Anterior", next: "Siguiente", close: "Cerrar", details: "Detalles" };

  function largest(picture) {
    var src = picture.querySelector('source[type="image/webp"]') || picture.querySelector("source");
    var list = src ? src.getAttribute("srcset").split(",") : [];
    var last = list.length ? list[list.length - 1].trim().split(/\s+/)[0] : "";
    return last || picture.querySelector("img").getAttribute("src");
  }

  function tileProvider(start) {
    var items = tiles.map(function (a) {
      var pic = a.querySelector("picture");
      var img = a.querySelector("img");
      return { src: largest(pic), alt: img.alt, href: a.getAttribute("href"), el: a };
    });
    return { start: start, get: function (i) { return Promise.resolve(items[i] || null); } };
  }

  function pageItem(doc, url) {
    var btn = doc.querySelector(".work-zoom");
    if (!btn) return null;
    var img = btn.querySelector("img");
    var p = doc.querySelector('.work-nav a[rel="prev"]');
    var n = doc.querySelector('.work-nav a[rel="next"]');
    return {
      src: btn.getAttribute("data-zoom-src"), alt: img ? img.alt : "", href: url,
      prevHref: p ? p.getAttribute("href") : null, nextHref: n ? n.getAttribute("href") : null
    };
  }

  function workProvider() {
    var cache = {}, lo = 0, hi = 0;
    cache[0] = pageItem(document, location.pathname);
    function fetchItem(href) {
      return fetch(href).then(function (r) { return r.text(); }).then(function (t) {
        return pageItem(new DOMParser().parseFromString(t, "text/html"), href);
      }).catch(function () { return null; });
    }
    return {
      start: 0,
      get: function (i) {
        if (cache[i] !== undefined) return Promise.resolve(cache[i]);
        var base = i < lo ? cache[lo] : i > hi ? cache[hi] : null;
        var href = base && (i < lo ? base.prevHref : base.nextHref);
        if (!href || (i < lo ? i !== lo - 1 : i !== hi + 1)) return Promise.resolve(null);
        return fetchItem(href).then(function (it) {
          if (it) { cache[i] = it; if (i < lo) lo = i; else hi = i; }
          return it;
        });
      }
    };
  }

  function openViewer(p, from) {
    provider = p; index = p.start; opener = from;
    overlay = document.createElement("div");
    overlay.className = "zoom-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<button class="zoom-close" aria-label="' + L.close + '">✕</button>' +
      '<button class="zoom-nav zoom-nav--prev" aria-label="' + L.prev + '" hidden>‹</button>' +
      '<button class="zoom-nav zoom-nav--next" aria-label="' + L.next + '" hidden>›</button>' +
      '<div class="zoom-stage"><img alt=""></div>' +
      '<div class="zoom-caption"><span class="zoom-title"></span><a class="zoom-details" hidden>' + L.details + '</a></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    var stage = overlay.querySelector(".zoom-stage");
    var img = overlay.querySelector("img");
    var zoomed = false;
    img.draggable = false;

    function setZoom(on, ev) {
      zoomed = on;
      stage.classList.toggle("is-zoomed", on);
      if (on && ev) {
        var r = img.getBoundingClientRect();
        stage.scrollLeft = (ev.clientX - r.left) / r.width * stage.scrollWidth - stage.clientWidth / 2;
        stage.scrollTop = (ev.clientY - r.top) / r.height * stage.scrollHeight - stage.clientHeight / 2;
      }
    }
    img.addEventListener("click", function (ev) { setZoom(!zoomed, ev); });

    // drag to pan when zoomed; swipe to navigate when not
    var down = false, sx = 0, sy = 0, ol = 0, ot = 0;
    stage.addEventListener("pointerdown", function (ev) {
      down = true; sx = ev.clientX; sy = ev.clientY;
      ol = stage.scrollLeft; ot = stage.scrollTop;
      if (zoomed) stage.setPointerCapture(ev.pointerId);
    });
    stage.addEventListener("pointermove", function (ev) {
      if (!down || !zoomed) return;
      stage.scrollLeft = ol - (ev.clientX - sx);
      stage.scrollTop = ot - (ev.clientY - sy);
    });
    stage.addEventListener("pointerup", function (ev) {
      if (!down) return;
      down = false;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!zoomed && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    });
    stage.addEventListener("pointercancel", function () { down = false; });

    var prevBtn = overlay.querySelector(".zoom-nav--prev");
    var nextBtn = overlay.querySelector(".zoom-nav--next");
    prevBtn.addEventListener("click", function () { go(-1); });
    nextBtn.addEventListener("click", function () { go(1); });
    overlay.querySelector(".zoom-close").addEventListener("click", closeViewer);
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay || ev.target === stage) closeViewer();
    });
    document.addEventListener("keydown", onKey);

    var busy = false;
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function loaded() {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return new Promise(function (res) {
        img.addEventListener("load", res, { once: true });
        img.addEventListener("error", res, { once: true });
      });
    }
    // old image slides out the way the arrow points, the new one slides in from the other side
    function slide(dir, swap) {
      if (calm || !img.animate) return Promise.resolve(swap());
      var out = img.animate(
        [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(" + (-dir * 60) + "px)" }],
        { duration: 180, easing: "ease-in", fill: "forwards" });
      return out.finished.then(function () { return swap(); }).then(function () {
        if (!overlay) return;
        return img.animate(
          [{ opacity: 0, transform: "translateX(" + (dir * 60) + "px)" }, { opacity: 1, transform: "translateX(0)" }],
          { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" }).finished.then(function () { out.cancel(); });
      }).catch(function () {});
    }
    function show(i, item) {
      index = i; current = item; setZoom(false);
      img.src = item.src; img.alt = item.alt;
      overlay.querySelector(".zoom-title").textContent = item.alt;
      var d = overlay.querySelector(".zoom-details");
      d.hidden = !tiles.length || !!zoomBtn;
      if (!d.hidden) d.setAttribute("href", item.href);
      // arrows appear once a neighbour is known to exist; preload it
      [-1, 1].forEach(function (dir) {
        provider.get(i + dir).then(function (n) {
          if (!overlay || index !== i) return;
          (dir < 0 ? prevBtn : nextBtn).hidden = !n;
          if (n) { var pre = new Image(); pre.src = n.src; }
        });
      });
    }
    overlay._go = function (dir) {
      if (busy) return;
      busy = true;
      provider.get(index + dir).then(function (n) {
        if (!n || !overlay) { busy = false; return; }
        slide(dir, function () { show(index + dir, n); return loaded(); }).then(function () { busy = false; });
      });
    };
    provider.get(index).then(function (it) { if (it) show(index, it); });
    overlay.querySelector(".zoom-close").focus();
  }

  function go(dir) { if (overlay) overlay._go(dir); }

  function onKey(ev) {
    if (ev.key === "Escape") closeViewer();
    else if (ev.key === "ArrowLeft") go(-1);
    else if (ev.key === "ArrowRight") go(1);
  }

  function closeViewer() {
    if (!overlay) return;
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    overlay = null;
    document.body.style.overflow = "";
    if (opener) opener.focus();
  }

  if (zoomBtn) zoomBtn.addEventListener("click", function () { openViewer(workProvider(), zoomBtn); });
  tiles.forEach(function (a, i) {
    a.addEventListener("click", function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return;
      ev.preventDefault();
      openViewer(tileProvider(i), a);
    });
  });
})();
