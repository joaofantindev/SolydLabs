/* ==========================================================================
   SOLYD // LABS — sala do laboratório (VM simulada + terminal + flags)
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var room = $("#room");
  if (!room) return;

  var slug = room.getAttribute("data-lab");
  var totalPoints = parseInt(room.getAttribute("data-total") || "0", 10);
  var targetUrl = room.getAttribute("data-target-url") || "";
  var ip = room.getAttribute("data-ip") || "";
  var running = room.getAttribute("data-running") === "true";
  var initialUptime = parseInt(room.getAttribute("data-uptime") || "0", 10) || 0;
  var starting = false;
  var startedAt = null;
  var uptimeTimer = null;
  var pollTimer = null;
  var seenCookie = false;
  var celebrated = false;

  var store = window.SOLYDStore || {
    read: function (k, d) { try { return JSON.parse(localStorage.getItem("solyd." + k)) || d; } catch (e) { return d; } },
    write: function (k, v) { try { localStorage.setItem("solyd." + k, JSON.stringify(v)); } catch (e) {} }
  };
  var toast = window.toast || function () {};

  var els = {
    start: $$(".js-start"),
    stop: $$(".js-stop"),
    reset: $$(".js-reset"),
    vmState: $("#vmState"),
    vmStateText: $("#vmStateText"),
    termStatus: $("#termStatus"),
    termScroll: $("#termScroll"),
    termOutput: $("#termOutput"),
    termForm: $("#termForm"),
    termInput: $("#termInput"),
    termPrompt: $("#termPrompt"),
    termLine: $(".term-line"),
    iframe: $("#targetFrame"),
    browserOffline: $("#browserOffline"),
    tabLive: $("[data-tab-live]"),
    urlPath: $("#urlPath"),
    vmCard: $(".vm-card"),
    vmPill: $("#vmPill"),
    vmSub: $("#vmSub"),
    vmUptime: $("#vmUptime"),
    objRing: $("#objRing"),
    objRingTxt: $("#objRingTxt"),
    objXp: $("#objXp"),
    objBar: $("#objBar"),
    bootOverlay: $("#bootOverlay"),
    bootLog: $("#bootLog"),
    bootBar: $("#bootBar"),
    bootFoot: $("#bootFoot"),
    bootSkip: $("#bootSkip")
  };

  /* ── flags locais ─────────────────────────────────────────────────────── */
  function labFlags() {
    var all = store.read("flags", {});
    return all[slug] || {};
  }
  function saveLabFlags(flags) {
    var all = store.read("flags", {});
    all[slug] = flags;
    store.write("flags", all);
    store.write("lastLab", slug);
    if (window.solydRefresh) window.solydRefresh();
  }

  function taskEls() { return $$(".task", room); }
  function taskById(id) { return $('.task[data-task-id="' + id + '"]', room); }

  function markTask(id, silent) {
    var el = taskById(id);
    if (!el) return;
    if (el.classList.contains("done")) { if (!silent) updateObjectives(); return; }
    el.classList.add("done");
    var msg = $("[data-task-msg]", el);
    if (msg) { msg.className = "task-msg ok"; msg.textContent = "Flag validada ✓"; }
    var form = $("[data-flag-form]", el);
    if (form) {
      var input = $("input", form);
      if (input) input.value = "";
    }
    updateObjectives();
  }

  function updateObjectives() {
    var tasks = taskEls();
    var done = tasks.filter(function (t) { return t.classList.contains("done"); });
    var pts = done.reduce(function (sum, t) { return sum + (parseInt(t.getAttribute("data-task-points") || "0", 10)); }, 0);
    var pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
    if (els.objRing) els.objRing.style.setProperty("--p", pct);
    if (els.objRingTxt) els.objRingTxt.textContent = done.length + "/" + tasks.length;
    if (els.objXp) els.objXp.textContent = pts;
    if (els.objBar) els.objBar.style.width = (totalPoints ? Math.round((pts / totalPoints) * 100) : 0) + "%";
    $$("[data-brief-task]").forEach(function (li) {
      var t = taskById(li.getAttribute("data-brief-task"));
      li.classList.toggle("done", !!(t && t.classList.contains("done")));
    });
    if (done.length === tasks.length && tasks.length && !celebrated) {
      celebrated = true;
      toast("Laboratório concluído", "Todas as flags foram capturadas. +" + pts + " XP.", "ok");
    }
  }

  function loadLocalFlags() {
    var flags = labFlags();
    Object.keys(flags).forEach(function (id) { markTask(id, true); });
    updateObjectives();
  }

  /* ── terminal ────────────────────────────────────────────────────────── */
  var history = [];
  var histIndex = -1;
  var commands = window.SOLYD_LAB_CMDS || [];

  function scrollTerm() {
    if (els.termScroll) els.termScroll.scrollTop = els.termScroll.scrollHeight;
  }

  function appendLine(text, cls) {
    if (!els.termOutput) return;
    var finalCls = cls || classify(text);
    var line = document.createElement("div");
    line.className = "t-out-line " + finalCls;
    line.textContent = text == null ? "" : String(text);
    els.termOutput.appendChild(line);
    var found = String(text || "").match(/SOLYD\{[^}]+\}/g);
    if (found) {
      found.forEach(function (flag) { appendFlagLine(flag); });
    }
    scrollTerm();
  }

  function appendFlagLine(flag) {
    if (!els.termOutput) return;
    if ($('[data-detected="' + flag + '"]', els.termOutput)) return;
    var wrap = document.createElement("div");
    wrap.className = "t-out-line t-detected";
    wrap.setAttribute("data-detected", flag);
    var tag = document.createElement("span");
    tag.className = "t-flag";
    tag.textContent = "⚑ FLAG DETECTADA: " + flag;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-cmd t-copy-flag";
    btn.setAttribute("data-copy", flag);
    btn.textContent = "copiar";
    wrap.appendChild(tag);
    wrap.appendChild(btn);
    els.termOutput.appendChild(wrap);
    scrollTerm();
  }

  function classify(text) {
    var s = String(text || "");
    if (/SOLYD\{/.test(s)) return "t-flag";
    if (/^\[-\]|permission denied|acesso negado|não encontrado|erro/i.test(s)) return "t-err";
    if (/^\[\+\]|flag|sucesso|online|ok\b/i.test(s)) return "t-ok";
    if (/^\[!\]|aviso|warning|legado/i.test(s)) return "t-warn";
    return "";
  }

  function echoCommand(cmd) {
    if (!els.termOutput) return;
    var line = document.createElement("div");
    line.className = "t-out-line t-cmd-line";
    var prompt = document.createElement("span");
    prompt.className = "term-prompt";
    prompt.textContent = els.termPrompt ? els.termPrompt.textContent : "$ ";
    var text = document.createElement("span");
    text.className = "t-cmd-text";
    text.textContent = " " + cmd;
    line.appendChild(prompt);
    line.appendChild(text);
    els.termOutput.appendChild(line);
    scrollTerm();
  }

  function printLines(lines) {
    (lines || []).forEach(function (line) { appendLine(line); });
  }

  function setPrompt(prompt) {
    if (els.termPrompt && prompt) els.termPrompt.textContent = prompt;
  }

  function terminalEnabled(on) {
    if (els.termInput) {
      els.termInput.disabled = !on;
      els.termInput.placeholder = on ? "digite help para começar..." : "inicie a aplicação para usar o terminal";
    }
    if (els.termLine) els.termLine.classList.toggle("locked", !on);
    if (els.termStatus) {
      els.termStatus.classList.toggle("on", on);
      els.termStatus.innerHTML = "<i></i> " + (on ? "online" : "offline");
    }
  }

  if (els.termForm) {
    els.termForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var cmd = (els.termInput.value || "").trim();
      els.termInput.value = "";
      if (!cmd) return;
      if (!running) {
        appendLine("[-] A aplicação não está em execução. Clique em 'Iniciar aplicação'.", "t-err");
        return;
      }
      history.unshift(cmd);
      histIndex = -1;
      echoCommand(cmd);
      els.termInput.disabled = true;
      fetch("/api/lab/" + encodeURIComponent(slug) + "/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ cmd: cmd })
      }).then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.clear) {
            els.termOutput.innerHTML = "";
          }
          printLines(data.lines);
          setPrompt(data.prompt);
        })
        .catch(function () { appendLine("[-] Falha de comunicação com o terminal.", "t-err"); })
        .then(function () {
          els.termInput.disabled = false;
          els.termInput.focus();
          scrollTerm();
        });
    });
    els.termInput.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (!history.length) return;
        histIndex = Math.min(histIndex + 1, history.length - 1);
        els.termInput.value = history[histIndex];
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        histIndex = Math.max(histIndex - 1, -1);
        els.termInput.value = histIndex === -1 ? "" : history[histIndex];
      } else if (ev.key === "Tab") {
        var partial = els.termInput.value;
        var match = commands.filter(function (c) { return c.indexOf(partial) === 0; })[0];
        if (match) { ev.preventDefault(); els.termInput.value = match; }
      }
    });
    if (els.termScroll) els.termScroll.addEventListener("click", function (ev) {
      if (ev.target.closest("button, a, input")) return;
      if (els.termInput) els.termInput.focus();
    });
    $$("[data-term-clear]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (els.termOutput) els.termOutput.innerHTML = "";
      });
    });
  }

  /* ── UI de estado da VM ──────────────────────────────────────────────── */
  function setRunning(on, opts) {
    opts = opts || {};
    running = on;
    els.start.forEach(function (b) { b.hidden = on; });
    els.stop.forEach(function (b) { b.hidden = !on; });

    if (els.vmState) {
      els.vmState.classList.toggle("on", on);
      if (els.vmStateText) els.vmStateText.textContent = on ? "VM online" : "VM parada";
    }
    if (els.vmCard) els.vmCard.classList.toggle("on", on);
    if (els.vmPill) els.vmPill.textContent = on ? "ON" : "OFF";
    if (els.vmSub) els.vmSub.textContent = on ? "online — serviços ativos" : "desligada";
    if (els.tabLive) els.tabLive.hidden = !on || !targetUrl;
    terminalEnabled(on);

    if (els.browserOffline) els.browserOffline.hidden = on;
    if (els.iframe) {
      els.iframe.hidden = !on;
      if (on) {
        var src = targetUrl;
        if (src) {
          var sep = src.indexOf("?") === -1 ? "?" : "&";
          els.iframe.src = src + sep + "_vm=" + Date.now();
        }
      } else {
        els.iframe.src = "about:blank";
      }
    }
    if (els.urlPath) {
      var path = targetUrl.replace(/^https?:\/\/[^/]+/, "").replace(/^\/target\/[^/]+/, "") || "/";
      els.urlPath.textContent = path;
    }

    if (on) {
      startedAt = Date.now() - (opts.uptime ? opts.uptime * 1000 : 0);
      if (!uptimeTimer) uptimeTimer = setInterval(tickUptime, 1000);
      tickUptime();
      if (!pollTimer) pollTimer = setInterval(pollState, 5000);
    } else {
      startedAt = null;
      if (uptimeTimer) { clearInterval(uptimeTimer); uptimeTimer = null; }
      if (els.vmUptime) els.vmUptime.textContent = "—";
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
  }

  function tickUptime() {
    if (!els.vmUptime || !startedAt) return;
    var s = Math.floor((Date.now() - startedAt) / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    els.vmUptime.textContent = (h ? h + "h " : "") + String(m).padStart(2, "0") + "m " + String(sec).padStart(2, "0") + "s";
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = busy;
    if (busy) {
      if (btn.dataset.oldHtml == null) btn.dataset.oldHtml = btn.innerHTML;
      btn.textContent = label || "Processando...";
    } else if (btn.dataset.oldHtml != null) {
      btn.innerHTML = btn.dataset.oldHtml;
      delete btn.dataset.oldHtml;
    }
  }

  /* ── boot animado ────────────────────────────────────────────────────── */
  var bootTimer = null;
  function playBoot(lines, done) {
    if (!els.bootOverlay || !els.bootLog) { done(); return; }
    if (els.bootLog) els.bootLog.textContent = "";
    if (els.bootBar) els.bootBar.style.width = "0%";
    if (els.bootFoot) els.bootFoot.textContent = "iniciando serviços...";
    els.bootOverlay.hidden = false;
    var i = 0;
    var finished = false;
    var total = lines.length || 1;

    function finish() {
      if (finished) return;
      finished = true;
      if (bootTimer) { clearInterval(bootTimer); bootTimer = null; }
      if (els.bootBar) els.bootBar.style.width = "100%";
      els.bootOverlay.hidden = true;
      done();
    }
    if (els.bootSkip) {
      els.bootSkip.onclick = finish;
    }
    bootTimer = setInterval(function () {
      if (i >= lines.length) { setTimeout(finish, 260); if (bootTimer) { clearInterval(bootTimer); bootTimer = null; } return; }
      if (els.bootLog) {
        els.bootLog.textContent += lines[i] + "\n";
        els.bootLog.scrollTop = els.bootLog.scrollHeight;
      }
      i++;
      if (els.bootBar) els.bootBar.style.width = Math.round((i / total) * 100) + "%";
      if (els.bootFoot && i > total - 2) els.bootFoot.textContent = "aguardando handshake final...";
    }, 110);
  }

  /* ── iniciar / parar / resetar ───────────────────────────────────────── */
  function doStart(btn) {
    if (starting || running) return;
    starting = true;
    els.start.forEach(function (b) { setBusy(b, true, "Iniciando..."); });
    fetch("/api/lab/" + encodeURIComponent(slug) + "/start", { method: "POST", headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) throw new Error("start");
        var lines = data.lines || [];
        playBoot(lines, function () {
          setRunning(true, { uptime: 0 });
          setPrompt(data.prompt);
          if (els.termOutput) els.termOutput.innerHTML = "";
          printLines(lines);
          if (els.termInput) els.termInput.focus();
          toast("Máquina virtual iniciada", (window.SOLYD && window.SOLYD.labs[slug] ? window.SOLYD.labs[slug].t : "Alvo") + " está online em " + ip, "ok");
        });
      })
      .catch(function () {
        toast("Falha ao iniciar", "Tente novamente em alguns segundos.", "err");
      })
      .then(function () {
        starting = false;
        els.start.forEach(function (b) { setBusy(b, false); b.hidden = running; });
      });
  }

  function doStop() {
    if (!running) return;
    els.stop.forEach(function (b) { setBusy(b, true, "Parando..."); });
    fetch("/api/lab/" + encodeURIComponent(slug) + "/stop", { method: "POST", headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setRunning(false);
        printLines(data.lines);
        toast("Máquina desligada", "A VM foi encerrada e o volume temporário removido.", "");
      })
      .catch(function () { toast("Falha ao parar", "Tente novamente.", "err"); })
      .then(function () { els.stop.forEach(function (b) { setBusy(b, false); }); });
  }

  function clearLocalFlags() {
    var all = store.read("flags", {});
    if (all[slug]) {
      delete all[slug];
      store.write("flags", all);
      if (window.solydRefresh) window.solydRefresh();
    }
  }

  function doReset() {
    if (!confirm("Resetar o laboratório? O estado do alvo e as flags desta sessão serão apagados.")) return;
    els.reset.forEach(function (b) { setBusy(b, true); });
    fetch("/api/lab/" + encodeURIComponent(slug) + "/reset", { method: "POST", headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setRunning(false);
        clearLocalFlags();
        celebrated = false;
        seenCookie = false;
        taskEls().forEach(function (t) {
          t.classList.remove("done");
          var msg = $("[data-task-msg]", t);
          if (msg) { msg.className = "task-msg"; msg.textContent = ""; }
        });
        $$("[data-brief-task]").forEach(function (li) { li.classList.remove("done"); });
        if (els.termOutput) els.termOutput.innerHTML = "";
        updateObjectives();
        printLines(data.lines);
        toast("Snapshot restaurado", "O laboratório voltou ao estado inicial.", "");
      })
      .catch(function () { toast("Falha ao resetar", "Tente novamente.", "err"); })
      .then(function () { els.reset.forEach(function (b) { setBusy(b, false); }); });
  }

  els.start.forEach(function (b) { b.addEventListener("click", function () { doStart(b); }); });
  els.stop.forEach(function (b) { b.addEventListener("click", doStop); });
  els.reset.forEach(function (b) { b.addEventListener("click", doReset); });

  /* ── envio de flags ──────────────────────────────────────────────────── */
  $$("[data-flag-form]", room).forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var task = form.closest(".task");
      var id = task.getAttribute("data-task-id");
      var points = parseInt(task.getAttribute("data-task-points") || "0", 10);
      var input = $("input", form);
      var flag = (input.value || "").trim();
      var msg = $("[data-task-msg]", task);
      if (!flag) {
        if (msg) { msg.className = "task-msg err"; msg.textContent = "Digite a flag antes de validar."; }
        return;
      }
      if (!running) {
        if (msg) { msg.className = "task-msg err"; msg.textContent = "Inicie a aplicação antes de enviar flags."; }
        return;
      }
      var btn = $("button", form);
      if (btn) { btn.disabled = true; btn.textContent = "..."; }
      fetch("/api/lab/" + encodeURIComponent(slug) + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ task: id, flag: flag })
      }).then(function (r) { return r.json().then(function (d) { d._status = r.status; return d; }); })
        .then(function (data) {
          if (data.ok) {
            var flags = labFlags();
            flags[id] = points;
            saveLabFlags(flags);
            markTask(id);
            toast(data.already ? "Flag já capturada" : "Flag válida!", data.already ? "Esta tarefa já estava concluída." : "+" + points + " XP — " + (data.message || ""), "ok");
            if (msg) { msg.className = "task-msg ok"; msg.textContent = data.already ? "Já capturada ✓" : "Flag válida! +" + points + " XP"; }
          } else {
            if (msg) { msg.className = "task-msg err"; msg.textContent = data.error || "Flag incorreta."; }
            task.classList.add("shake");
            setTimeout(function () { task.classList.remove("shake"); }, 400);
            toast("Flag incorreta", "Revise o caminho e tente novamente.", "err");
          }
        })
        .catch(function () {
          if (msg) { msg.className = "task-msg err"; msg.textContent = "Falha de comunicação. Tente novamente."; }
        })
        .then(function () {
          if (btn) { btn.disabled = false; btn.textContent = "Validar"; }
          if (input) input.focus();
        });
    });
  });

  /* ── dicas ───────────────────────────────────────────────────────────── */
  $$("[data-hint-btn]", room).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var hint = btn.parentElement.querySelector("[data-hint]");
      if (!hint) return;
      hint.hidden = !hint.hidden;
      btn.innerHTML = hint.hidden ? 'Dica <span class="chev">▾</span>' : 'Ocultar dica <span class="chev">▴</span>';
    });
  });

  /* ── abas ────────────────────────────────────────────────────────────── */
  function openTab(name) {
    $$(".rtab", room).forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
    $$("[data-panel]", room).forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-panel") === name); });
    if (name === "terminal" && els.termInput) setTimeout(function () { els.termInput.focus(); }, 40);
  }
  $$(".rtab", room).forEach(function (tab) {
    tab.addEventListener("click", function () { openTab(tab.getAttribute("data-tab")); });
  });
  $$("[data-goto-tab]", room).forEach(function (b) {
    b.addEventListener("click", function () { openTab(b.getAttribute("data-goto-tab")); });
  });

  /* ── iframe ──────────────────────────────────────────────────────────── */
  function reloadFrame() {
    if (!running || !els.iframe || !targetUrl) return;
    var sep = targetUrl.indexOf("?") === -1 ? "?" : "&";
    els.iframe.src = targetUrl + sep + "_r=" + Date.now();
  }
  var reloadBtn = $("#reloadFrame");
  if (reloadBtn) reloadBtn.addEventListener("click", reloadFrame);
  var openBtn = $("#openFrame");
  if (openBtn && targetUrl) openBtn.href = targetUrl;

  /* ── estado do servidor ──────────────────────────────────────────────── */
  function pollState(silent) {
    if (!running) return;
    fetch("/api/lab/" + encodeURIComponent(slug) + "/state", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.running) {
          if (!silent) return;
          return;
        }
        var serverFlags = data.flags || {};
        if (Object.keys(serverFlags).length) {
          var flags = labFlags();
          Object.keys(serverFlags).forEach(function (id) {
            var el = taskById(id);
            if (el) {
              flags[id] = parseInt(el.getAttribute("data-task-points") || "0", 10);
              markTask(id, true);
            }
          });
          saveLabFlags(flags);
        }
        var ev = data.events || {};
        if (ev.captured_cookie && !seenCookie) {
          seenCookie = true;
          toast("Cookie capturado no ShoutBox", ev.captured_cookie, "ok");
        }
      })
      .catch(function () { /* silencioso */ });
  }

  /* ── boot da página ──────────────────────────────────────────────────── */
  loadLocalFlags();
  var _allTasks = taskEls();
  if (_allTasks.length && _allTasks.every(function (t) { return t.classList.contains("done"); })) {
    celebrated = true;
  }
  if (window.SOLYD && window.SOLYD.labs && window.SOLYD.labs[slug]) {
    store.write("lastLab", slug);
  }

  if (running) {
    setRunning(true, { uptime: initialUptime });
    appendLine("[*] Reconectando à sessão existente da VM...");
    appendLine("[+] Aplicação online em http://" + ip + "/");
    appendLine("[i] Digite 'help' para ver os comandos sugeridos.");
    pollState(true);
  } else {
    setRunning(false);
    appendLine("╭──────────────────────────────────────────────╮");
    appendLine("│  SOLYD // LABS · " + (slug + "").toUpperCase().padEnd(24) + "│");
    appendLine("╰──────────────────────────────────────────────╯");
    appendLine("A máquina está desligada. Clique em “Iniciar aplicação” para");
    appendLine("subir o alvo, montar a rede isolada e liberar o terminal.");
    appendLine("Nada será executado fora do seu navegador.");
  }

  updateObjectives();
})();
