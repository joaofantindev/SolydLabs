# -*- coding: utf-8 -*-
"""SOLYD // LABS — plataforma local de treinamento ofensivo."""
import os
import random
import time

from flask import Flask, abort, jsonify, redirect, render_template, request, url_for

import data
import lab_targets
import state
import terminal

app = Flask(__name__)
app.secret_key = os.environ.get("SOLYD_SECRET", "solyd-labs-local-dev-only-2026")
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024
app.register_blueprint(lab_targets.bp)


@app.context_processor
def inject_globals():
    return {
        "TRILHAS": data.TRILHAS,
        "CURSOS": data.CURSOS,
        "CERTS": data.CERTIFICACOES,
        "LABS": data.LABS,
        "LAB_ORDER": data.LAB_ORDER,
        "NIVEIS": data.NIVEIS,
        "get_curso": data.curso,
        "get_trilha": data.trilha,
        "get_lab": data.lab,
        "get_cert": data.cert,
        "cursos_da_trilha": data.cursos_da_trilha,
        "labs_da_trilha": data.labs_da_trilha,
        "total_cursos": sum(1 for c in data.CURSOS.values() if not c.get("gratis")),
        "total_horas": sum(c["horas"] for c in data.CURSOS.values()),
        "total_labs": len(data.LABS),
        "total_certs": len(data.CERTIFICACOES),
        "total_flags": sum(len(l["tarefas"]) for l in data.LABS.values()),
        "total_points": sum(l["pontos"] for l in data.LABS.values()),
    }


@app.get("/")
def index():
    destaques = data.TRILHAS[:4]
    return render_template("index.html", destaques=destaques)


@app.get("/trilhas")
def trilhas():
    return render_template("trilhas.html")


@app.get("/trilha/<slug>")
def trilha_page(slug):
    t = data.trilha(slug)
    if not t:
        abort(404)
    return render_template("trilha.html", trilha=t, cursos=data.cursos_da_trilha(t),
                           labs=data.labs_da_trilha(t))


@app.get("/curso/<slug>")
def curso_page(slug):
    c = data.curso(slug)
    if not c:
        abort(404)
    t = data.trilha(data.TRILHA_DE_CURSO.get(slug, ""))
    labs = [data.LABS[c["lab"]]] if c.get("lab") else []
    cert = data.CERTIFICACOES.get(c.get("cert") or "")
    return render_template("curso.html", curso=c, trilha=t, labs=labs, cert=cert)


@app.get("/labs")
def labs():
    return render_template("labs.html")


@app.get("/lab/<slug>")
def lab_page(slug):
    lab = data.lab(slug)
    if not lab:
        abort(404)
    entry = state.get(slug)
    running = entry is not None
    return render_template("lab.html", lab=lab, running=running,
                           uptime=state.uptime(slug) if running else 0,
                           related=[l for l in data.LABS.values() if l["categoria"] == lab["categoria"] and l["slug"] != slug][:3])


@app.get("/certificacoes")
def certificacoes():
    return render_template("certificacoes.html")


@app.get("/certificacao/<slug>")
def certificacao_page(slug):
    c = data.cert(slug)
    if not c:
        abort(404)
    trilhas = [data.trilha(s) for s in c["trilhas"]]
    labs_list = [data.LABS[s] for s in c["labs"] if s in data.LABS]
    return render_template("certificacao.html", cert=c, trilhas=[t for t in trilhas if t], labs_list=labs_list)


@app.get("/ranking")
def ranking():
    players = [
        {"pos": 1, "nome": "m4ch4d0", "xp": 4820, "flags": 24, "pais": "BR", "badge": "SYCP"},
        {"pos": 2, "nome": "n0ir", "xp": 4310, "flags": 21, "pais": "BR", "badge": "SYES"},
        {"pos": 3, "nome": "coral.exe", "xp": 3890, "flags": 19, "pais": "PT", "badge": "SYWP"},
        {"pos": 4, "nome": "k4rm4", "xp": 3220, "flags": 17, "pais": "BR", "badge": "SYAP"},
        {"pos": 5, "nome": "vuln3r", "xp": 2870, "flags": 15, "pais": "AR", "badge": "SYH2"},
        {"pos": 6, "nome": "s0l", "xp": 2410, "flags": 13, "pais": "BR", "badge": None},
        {"pos": 7, "nome": "bytefox", "xp": 1980, "flags": 11, "pais": "BR", "badge": None},
    ]
    return render_template("ranking.html", players=players)


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


# ── API DOS LABS ────────────────────────────────────────────────────────────
@app.get("/api/labs/status")
def api_status():
    now = time.time()
    out = {}
    for slug in state.running_slugs():
        e = state.get(slug)
        if e:
            out[slug] = {"running": True, "uptime": int(now - e["started"])}
    return jsonify({"labs": out, "server_time": int(now)})


@app.post("/api/lab/<slug>/start")
def api_start(slug):
    lab = data.lab(slug)
    if not lab:
        abort(404)
    entry = state.start(slug)
    ctx = entry["ctx"]
    services = "\n".join("  [ OK ] " + s for s in lab["servicos"])
    lines = list(lab["boot"]) + [
        "",
        "─" * 62,
        f"  HOST      {lab['ip']}",
        f"  SISTEMA   {lab['os']}",
        "  SERVIÇOS",
        services,
        "─" * 62,
        "[+] Aplicação iniciada. Bom hacking.",
    ]
    return jsonify({"ok": True, "running": True, "uptime": 0,
                    "lines": lines, "prompt": terminal._prompt(slug, ctx)})


@app.post("/api/lab/<slug>/stop")
def api_stop(slug):
    if not data.lab(slug):
        abort(404)
    state.stop(slug)
    return jsonify({"ok": True, "running": False, "lines": [
        "[*] Enviando SIGTERM para os serviços...",
        "[ OK ] nginx, sshd e aplicação encerrados",
        "[ OK ] Volume temporário desmontado",
        "[-] Máquina desligada. Nenhum dado persistido.",
    ]})


@app.post("/api/lab/<slug>/reset")
def api_reset(slug):
    if not data.lab(slug):
        abort(404)
    state.reset(slug)
    return jsonify({"ok": True, "running": False, "lines": ["[*] Snapshot restaurado.", "[-] Laboratório resetado."]})


@app.post("/api/lab/<slug>/terminal")
def api_terminal(slug):
    if not data.lab(slug):
        abort(404)
    data_json = request.get_json(silent=True) or {}
    cmd = str(data_json.get("cmd", ""))[:500]
    entry = state.get(slug)
    if not entry:
        return jsonify({"ok": False, "error": "offline",
                        "lines": ["[-] A aplicação não está em execução. Clique em 'Iniciar aplicação'."],
                        "prompt": "offline@solyd:~$ "}), 409
    result = terminal.run(slug, cmd, entry["ctx"])
    return jsonify({"ok": True, **result})


@app.post("/api/lab/<slug>/submit")
def api_submit(slug):
    lab = data.lab(slug)
    if not lab:
        abort(404)
    payload = request.get_json(silent=True) or {}
    task_id = payload.get("task")
    flag = str(payload.get("flag", "")).strip()
    task = next((t for t in lab["tarefas"] if t["id"] == task_id), None)
    entry = state.get(slug)
    if not task:
        return jsonify({"ok": False, "error": "Tarefa inválida."}), 400
    if not entry:
        return jsonify({"ok": False, "error": "Inicie a aplicação antes de enviar flags."}), 409
    ctx = entry["ctx"]
    flags = ctx.setdefault("flags", {})
    if flags.get(task_id):
        return jsonify({"ok": True, "already": True, "message": "Esta flag já foi capturada.",
                        "points": task["pontos"], "task": task_id})
    if flag.lower() == task["flag"].lower():
        flags[task_id] = True
        return jsonify({"ok": True, "message": f"Flag válida! +{task['pontos']} XP",
                        "points": task["pontos"], "task": task_id,
                        "total": sum(t["pontos"] for t in lab["tarefas"] if flags.get(t["id"]))})
    return jsonify({"ok": False, "error": "Flag incorreta. Revise o caminho e tente novamente."}), 200


@app.get("/api/lab/<slug>/state")
def api_lab_state(slug):
    lab = data.lab(slug)
    if not lab:
        abort(404)
    entry = state.get(slug)
    if not entry:
        return jsonify({"running": False, "uptime": 0, "flags": {}, "events": {}})
    ctx = entry["ctx"]
    events = {}
    if slug == "shoutbox":
        events["captured_cookie"] = ctx.get("captured_cookie")
        events["bot_log"] = ctx.get("bot_log", [])
    if slug == "eletroninja":
        events["user"] = ctx.get("user")
    if slug == "papiro":
        events["uploaded"] = ctx.get("uploaded")
    return jsonify({
        "running": True,
        "uptime": state.uptime(slug),
        "flags": ctx.get("flags", {}),
        "events": events,
    })


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "labs": len(data.LABS), "cursos": len(data.CURSOS)})


def _abrir_navegador(port):
    # Pequeno atraso para o socket já estar aceitando conexões.
    time.sleep(1.2)
    try:
        import webbrowser
        webbrowser.open(f"http://127.0.0.1:{port}")
    except Exception:
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("SOLYD_DEBUG", "").lower() in ("1", "true", "yes", "on")
    sem_navegador = os.environ.get("SOLYD_NO_BROWSER", "").lower() in ("1", "true", "yes", "on")
    print("\n  SOLYD // LABS  ->  http://127.0.0.1:%s\n" % port)
    if not sem_navegador and not debug:
        import threading
        threading.Thread(target=_abrir_navegador, args=(port,), daemon=True).start()
    app.run(host="127.0.0.1", port=port, debug=debug, use_reloader=debug)
