/* ==========================================================================
   SOLYD // LABS — app shell: XP, progresso, filtros, busca e toasts
   Nada aqui fala com serviços externos. Tudo fica no localStorage.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var S = window.SOLYD || { labs: {}, levels: [[0, "Script Kiddie"]], tracks: {}, index: [] };
  var PREFIX = "solyd.";

  /* ── storage ─────────────────────────────────────────────────────────── */
  var store = {
    read: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    write: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* modo privado */ }
    }
  };
  window.SOLYDStore = store;

  function getFlags() { return store.read("flags", {}); }
  function getCourses() { return store.read("courses", {}); }

  function flagCount() {
    var flags = getFlags(), n = 0;
    Object.keys(flags).forEach(function (lab) { n += Object.keys(flags[lab] || {}).length; });
    return n;
  }
  function totalXp() {
    var flags = getFlags(), xp = 0;
    Object.keys(flags).forEach(function (lab) {
      var tasks = flags[lab] || {};
      Object.keys(tasks).forEach(function (t) { xp += Number(tasks[t]) || 0; });
    });
    xp += Object.keys(getCourses()).length * 40;
    return xp;
  }
  function levelFor(xp) {
    var levels = (S.levels && S.levels.length ? S.levels : [[0, "Script Kiddie"]]);
    var i = 0;
    for (var k = 0; k < levels.length; k++) { if (xp >= levels[k][0]) i = k; }
    return {
      index: i,
      name: levels[i][1],
      floor: levels[i][0],
      next: levels[i + 1] ? levels[i + 1][0] : null,
      nextName: levels[i + 1] ? levels[i + 1][1] : null
    };
  }
  function labTaskTotal() {
    var n = 0;
    Object.keys(S.labs || {}).forEach(function (slug) { n += (S.labs[slug].n || 0); });
    return n;
  }
  function trackPct(slug) {
    var courses = (S.tracks && S.tracks[slug]) || [];
    if (!courses.length) return 0;
    var done = getCourses(), c = 0;
    courses.forEach(function (s) { if (done[s]) c++; });
    return Math.round((c / courses.length) * 100);
  }

  function coursePct(slug) {
    if (getCourses()[slug]) return 100;
    var root = document.querySelector('.course-main[data-course="' + slug + '"]');
    if (!root) return 0;
    var mods = $$(".module", root);
    if (!mods.length) return 0;
    var on = mods.filter(function (m) { return m.classList.contains("done"); }).length;
    return Math.round((on / mods.length) * 100);
  }

  function refresh() {
    var xp = totalXp(), lv = levelFor(xp), flags = flagCount();
    var tasks = labTaskTotal() || 1;
    var pct = Math.min(100, Math.round((flags / tasks) * 100));

    $$("#xpValue").forEach(function (el) { el.textContent = xp.toLocaleString("pt-BR"); });
    $$("#sidebarXp").forEach(function (el) { el.textContent = xp.toLocaleString("pt-BR") + " XP"; });
    $$("#sidebarFlags").forEach(function (el) { el.textContent = flags + (flags === 1 ? " flag" : " flags"); });
    $$("#sidebarLevel, #rankName").forEach(function (el) { el.textContent = lv.name; });

    var ring = $("#miniRing");
    if (ring) {
      ring.style.setProperty("--p", pct);
      ring.style.setProperty("--ring", lv.index >= 4 ? "#2ce6b0" : "#ff3557");
      var v = $("#miniRingVal");
      if (v) v.textContent = pct + "%";
    }
    var bar = $("#sidebarBar");
    if (bar) bar.style.width = pct + "%";

    $$("[data-track-bar]").forEach(function (el) { el.style.width = trackPct(el.getAttribute("data-track-bar")) + "%"; });
    $$("[data-track-pct]").forEach(function (el) { el.textContent = trackPct(el.getAttribute("data-track-pct")) + "%"; });
    $$("[data-track-pct-lg]").forEach(function (el) { el.textContent = trackPct(el.getAttribute("data-track-pct-lg")) + "%"; });
    $$("[data-track-ring]").forEach(function (el) { el.style.setProperty("--p", trackPct(el.getAttribute("data-track-ring"))); });

    $$("[data-course-pct]").forEach(function (el) {
      el.textContent = coursePct(el.getAttribute("data-course-pct")) + "%";
    });
    $$("[data-course-ring]").forEach(function (el) {
      el.style.setProperty("--p", coursePct(el.getAttribute("data-course-ring")));
    });

    // cursos concluídos
    var done = getCourses();
    $$("[data-course-done]").forEach(function (btn) {
      var slug = btn.getAttribute("data-course-done");
      var isDone = !!done[slug];
      btn.classList.toggle("done", isDone);
      var label = btn.querySelector("[data-done-label]");
      if (label) {
        if (!label.dataset.def) label.dataset.def = label.textContent.trim();
        label.textContent = isDone ? "Concluído" : label.dataset.def;
      }
      var row = btn.closest(".course-row");
      if (row) row.classList.toggle("done", isDone);
    });

    refreshRanking(xp, flags, lv);
    refreshResume();
  }

  function refreshRanking(xp, flags, lv) {
    var you = $("#youXp");
    if (!you) return;
    you.textContent = xp.toLocaleString("pt-BR");
    var yf = $("#youFlags"); if (yf) yf.textContent = flags;
    var yl = $("#youLevel"); if (yl) yl.textContent = lv.name;
    var rp = $("#yourRowXp"); if (rp) rp.innerHTML = xp.toLocaleString("pt-BR") + " <small>XP</small>";
    var rf = $("#yourRowFlagsVal") || $("#yourRowFlags");
    if (rf) rf.textContent = flags;

    var scores = $$(".lb-row:not(.you) .lb-xp").map(function (el) {
      return parseInt((el.textContent || "0").replace(/[^\d]/g, ""), 10) || 0;
    });
    var pos = scores.filter(function (s) { return s > xp; }).length + 1;
    var posEl = $("#youPos"); if (posEl) posEl.textContent = "#" + pos;
    var rowPos = $("#yourRowPos"); if (rowPos) rowPos.textContent = "#" + pos;

    var top = $("#youNextXp"), bar = $("#youBar"), lab = $("#youNextLabel");
    if (lv.next) {
      var pct = Math.max(0, Math.min(100, Math.round(((xp - lv.floor) / (lv.next - lv.floor)) * 100)));
      if (top) top.textContent = xp + " / " + lv.next;
      if (bar) bar.style.width = pct + "%";
      if (lab) lab.textContent = "Próximo: " + lv.nextName;
    } else {
      if (top) top.textContent = xp + " XP";
      if (bar) bar.style.width = "100%";
      if (lab) lab.textContent = "Nível máximo alcançado";
    }
  }

  function refreshResume() {
    var bar = $("#resumeBar");
    if (!bar) return;
    var last = store.read("lastLab", null);
    if (!last || !S.labs || !S.labs[last]) { bar.hidden = true; return; }
    var flags = getFlags()[last] || {};
    var taken = Object.keys(flags).length;
    var total = S.labs[last].n || 0;
    var txt = $("#resumeText");
    if (txt) txt.textContent = taken >= total ? "Lab concluído — que tal encarar o próximo alvo?" : taken + " de " + total + " flags capturadas em " + S.labs[last].t;
    var link = $("#resumeLink");
    if (link) link.href = "/lab/" + last;
    bar.hidden = false;
  }

  /* ── toasts ──────────────────────────────────────────────────────────── */
  function toast(title, message, type) {
    var box = $("#toasts");
    if (!box) return;
    var el = document.createElement("div");
    el.className = "toast " + (type || "");
    var ico = document.createElement("span");
    ico.className = "ti";
    ico.textContent = type === "ok" ? "✓" : type === "err" ? "!" : "›";
    var body = document.createElement("div");
    var strong = document.createElement("strong");
    strong.textContent = title;
    body.appendChild(strong);
    if (message) {
      var span = document.createElement("span");
      span.textContent = message;
      body.appendChild(span);
    }
    var close = document.createElement("button");
    close.className = "tx";
    close.setAttribute("aria-label", "Fechar");
    close.textContent = "×";
    close.addEventListener("click", function () { remove(); });
    el.appendChild(ico);
    el.appendChild(body);
    el.appendChild(close);
    box.appendChild(el);
    var timer = setTimeout(remove, 4600);
    function remove() {
      clearTimeout(timer);
      el.style.opacity = "0";
      el.style.transform = "translateX(14px)";
      el.style.transition = ".22s";
      setTimeout(function () { el.remove(); }, 230);
    }
  }
  window.toast = toast;

  /* ── copiar comandos ─────────────────────────────────────────────────── */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        resolve();
      } catch (e) { reject(e); }
    });
  }
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-copy]");
    if (!btn) return;
    var text = btn.getAttribute("data-copy") || btn.textContent;
    copyText(text).then(function () { toast("Copiado", text, "ok"); })
      .catch(function () { toast("Não foi possível copiar", "Selecione o texto manualmente.", "err"); });
  });

  /* ── cursos e módulos ────────────────────────────────────────────────── */
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-course-done]");
    if (!btn) return;
    var slug = btn.getAttribute("data-course-done");
    var done = getCourses();
    if (done[slug]) {
      delete done[slug];
      toast("Curso desmarcado", "O progresso da trilha foi recalculado.", "");
    } else {
      done[slug] = true;
      toast("Curso concluído", "+40 XP adicionados ao seu perfil.", "ok");
    }
    store.write("courses", done);
    refresh();
  });

  // módulos: persistência simples por curso + índice
  var modulesRoot = $(".course-main[data-course]");
  if (modulesRoot) {
    var courseSlug = modulesRoot.getAttribute("data-course");
    var modsState = store.read("modules", {});
    var saved = modsState[courseSlug] || {};
    $$(".module", modulesRoot).forEach(function (mod, i) {
      var btn = $(".mod-done", mod);
      if (!btn) return;
      if (saved[i]) markModule(btn, true);
      btn.addEventListener("click", function () {
        var on = !btn.classList.contains("on");
        markModule(btn, on);
        modsState[courseSlug] = modsState[courseSlug] || {};
        modsState[courseSlug][i] = on;
        store.write("modules", modsState);
        refresh();
      });
    });
  }
  function markModule(btn, on) {
    btn.classList.toggle("on", on);
    if (on) {
      btn.innerHTML = "✓ módulo concluído";
      var mod = btn.closest(".module");
      if (mod) mod.classList.add("done");
    } else {
      btn.innerHTML = "✓ marcar módulo";
      var mod2 = btn.closest(".module");
      if (mod2) mod2.classList.remove("done");
    }
  }

  /* ── filtros de trilhas e labs ───────────────────────────────────────── */
  function applyFilter(items, predicate, emptyEl) {
    var shown = 0;
    items.forEach(function (el) {
      var ok = predicate(el);
      el.hidden = !ok;
      if (ok) shown++;
    });
    if (emptyEl) emptyEl.hidden = shown !== 0;
  }

  var trilhaGrid = $("#trilhaGrid");
  if (trilhaGrid) {
    var tLevel = "all", tTerm = "";
    var tItems = $$(".filter-item", trilhaGrid);
    var tEmpty = $("#trilhaEmpty");
    var tSearch = $("#trilhaSearch");
    function tFilter() {
      applyFilter(tItems, function (el) {
        var level = el.getAttribute("data-level") || "";
        var name = el.getAttribute("data-name") || "";
        var okLevel = tLevel === "all" || level === tLevel;
        var okTerm = !tTerm || name.indexOf(tTerm) !== -1;
        return okLevel && okTerm;
      }, tEmpty);
    }
    $$("[data-filter-bar] [data-level]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        $$("[data-filter-bar] [data-level]").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        tLevel = chip.getAttribute("data-level");
        tFilter();
      });
    });
    if (tSearch) tSearch.addEventListener("input", function () {
      tTerm = tSearch.value.trim().toLowerCase();
      tFilter();
    });
  }

  var labGrid = $("#labGrid");
  if (labGrid) {
    var lCat = "all", lDif = "all", lTerm = "";
    var lItems = $$(".filter-item", labGrid);
    var lEmpty = $("#labEmpty");
    var lSearch = $("#labSearch");
    var lSelect = $("#difFilter");
    function lFilter() {
      applyFilter(lItems, function (el) {
        var cat = el.getAttribute("data-cat") || "";
        var dif = el.getAttribute("data-dif") || "";
        var name = el.getAttribute("data-name") || "";
        var okCat = lCat === "all" || cat === lCat;
        var okDif = lDif === "all" || dif === lDif;
        var okTerm = !lTerm || name.indexOf(lTerm) !== -1;
        return okCat && okDif && okTerm;
      }, lEmpty);
    }
    $$("[data-cat-chips] [data-cat]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        $$("[data-cat-chips] [data-cat]").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        lCat = chip.getAttribute("data-cat");
        lFilter();
      });
    });
    if (lSelect) lSelect.addEventListener("change", function () { lDif = lSelect.value; lFilter(); });
    if (lSearch) lSearch.addEventListener("input", function () {
      lTerm = lSearch.value.trim().toLowerCase();
      lFilter();
    });
  }

  /* ── status das VMs ──────────────────────────────────────────────────── */
  function refreshLabsStatus() {
    if (!window.fetch || !document.querySelector("[data-lab-live]")) return;
    fetch("/api/labs/status", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var labs = (data && data.labs) || {};
        $$("[data-lab-live]").forEach(function (dot) {
          var slug = dot.getAttribute("data-lab-live");
          dot.classList.toggle("on", !!labs[slug]);
          dot.title = labs[slug] ? "VM online há " + labs[slug].uptime + "s" : "VM parada";
        });
        var count = $("#onlineCount");
        if (count) count.textContent = Object.keys(labs).length;
      })
      .catch(function () { /* silencioso */ });
  }

  /* ── countdown do CTF ────────────────────────────────────────────────── */
  var cd = $("[data-countdown]");
  if (cd) {
    var target = new Date("2026-12-05T20:00:00-03:00").getTime();
    if (target < Date.now()) target += 90 * 24 * 60 * 60 * 1000;
    function tick() {
      var diff = Math.max(0, target - Date.now());
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var set = function (k, v) { var el = cd.querySelector('[data-cd="' + k + '"]'); if (el) el.textContent = String(v).padStart(2, "0"); };
      set("d", d); set("h", h); set("m", m); set("s", s);
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ── command palette ─────────────────────────────────────────────────── */
  var palette = $("#palette");
  var pInput = $("#paletteInput");
  var pResults = $("#paletteResults");
  var scrim = $("#scrim");
  var sel = 0;

  var KIND = { page: "#", trilha: "T", curso: "C", lab: "L", cert: "A" };
  function paletteData() { return (S.index || []); }
  function openPalette() {
    if (!palette) return;
    palette.classList.add("open");
    palette.setAttribute("aria-hidden", "false");
    if (scrim) scrim.classList.add("show");
    if (pInput) { pInput.value = ""; setTimeout(function () { pInput.focus(); }, 40); }
    renderPalette("");
  }
  function closePalette() {
    if (!palette) return;
    palette.classList.remove("open");
    palette.setAttribute("aria-hidden", "true");
    if (scrim) scrim.classList.remove("show");
  }
  function renderPalette(term) {
    if (!pResults) return;
    var q = (term || "").toLowerCase().trim();
    var list = paletteData().filter(function (it) {
      return !q || (it.t + " " + it.s + " " + it.k).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 9);
    if (!list.length) {
      pResults.innerHTML = '<div class="palette-empty">Nenhum resultado para “' + escapeHtml(term) + '”.</div>';
      return;
    }
    sel = Math.min(sel, list.length - 1);
    pResults.innerHTML = list.map(function (it, i) {
      return '<div class="palette-item ' + (i === sel ? "sel" : "") + '" data-url="' + escapeHtml(it.u) + '" data-i="' + i + '">' +
        '<span class="pi-ico">' + (KIND[it.k] || "#") + "</span>" +
        '<span class="pi-t">' + escapeHtml(it.t) + "</span>" +
        '<span class="pi-s">' + escapeHtml(it.s.split(" · ")[0]) + "</span></div>";
    }).join("");
    $$(".palette-item", pResults).forEach(function (el) {
      el.addEventListener("click", function () { window.location.href = el.getAttribute("data-url"); });
      el.addEventListener("mousemove", function () {
        $$(".palette-item", pResults).forEach(function (x) { x.classList.remove("sel"); });
        el.classList.add("sel");
        sel = Number(el.getAttribute("data-i"));
      });
    });
  }
  function moveSelection(dir) {
    var items = $$(".palette-item", pResults);
    if (!items.length) return;
    sel = (sel + dir + items.length) % items.length;
    items.forEach(function (x, i) { x.classList.toggle("sel", i === sel); });
    var cur = items[sel];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
  }
  if (pInput) {
    pInput.addEventListener("input", function () { sel = 0; renderPalette(pInput.value); });
    pInput.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); moveSelection(1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); moveSelection(-1); }
      else if (ev.key === "Enter") {
        ev.preventDefault();
        var cur = $(".palette-item.sel", pResults);
        if (cur) window.location.href = cur.getAttribute("data-url");
      }
    });
  }
  var searchTrigger = $("#searchTrigger");
  if (searchTrigger) searchTrigger.addEventListener("click", openPalette);
  if (scrim) scrim.addEventListener("click", closePalette);
  document.addEventListener("keydown", function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
      ev.preventDefault();
      if (palette && palette.classList.contains("open")) closePalette(); else openPalette();
    } else if (ev.key === "Escape") {
      closePalette();
    }
  });

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  window.solydEscape = escapeHtml;

  /* ── menu mobile ─────────────────────────────────────────────────────── */
  var menuBtn = $("#menuBtn");
  var sidebar = $("#sidebar");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", function () {
      sidebar.classList.toggle("open");
      if (scrim) scrim.classList.toggle("show", sidebar.classList.contains("open"));
    });
    if (scrim) scrim.addEventListener("click", function () { sidebar.classList.remove("open"); });
  }

  /* ── boot ────────────────────────────────────────────────────────────── */
  refresh();
  refreshLabsStatus();
  setInterval(refreshLabsStatus, 15000);
  window.solydRefresh = refresh;
})();
