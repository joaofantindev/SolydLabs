# -*- coding: utf-8 -*-
"""Terminal simulado dos laboratórios.

Nenhum comando é executado no sistema operacional real. Toda a saída é
simulada em Python para manter o ambiente seguro e reproduzível.
"""
import re

import data

FLAG_RE = re.compile(r"SOLYD\{[^}]+\}")


def _prompt(slug, ctx):
    if slug == "loupe":
        if ctx.get("root"):
            return "root@loupe:/root# "
        cwd = ctx.get("cwd", "/var/www/loupe")
        return f"www-data@loupe:{cwd}$ "
    return f"kali@solyd:~/labs/{slug}$ "


def _res(lines, slug, ctx, clear=False):
    return {"lines": lines, "prompt": _prompt(slug, ctx), "clear": clear}


def run(slug, raw, ctx):
    if ctx is None:
        return _res(["[-] A aplicação não está em execução. Inicie o laboratório primeiro."], slug, {})
    ctx.setdefault("cwd", "/var/www/loupe" if slug == "loupe" else f"/home/kali/labs/{slug}")
    cmdline = (raw or "").strip()
    if not cmdline:
        return _res([], slug, ctx)

    head = cmdline.split()[0].lower()

    if head == "clear":
        return _res([], slug, ctx, clear=True)
    if head in ("help", "?", "comandos"):
        return _res(_help(slug, ctx), slug, ctx)
    if head in ("pwd",):
        return _res([ctx.get("cwd", "/")], slug, ctx)
    if head in ("whoami",):
        return _res([("root" if ctx.get("root") else ("www-data" if slug == "loupe" else "kali"))], slug, ctx)

    if slug == "pingo-verde":
        return _res(_pingo(cmdline, ctx), slug, ctx)
    if slug == "meridiano":
        return _res(_meridiano(cmdline, ctx), slug, ctx)
    if slug == "loupe":
        return _res(_loupe(cmdline, ctx), slug, ctx)
    return _res(_web(slug, cmdline, ctx), slug, ctx)


def _help(slug, ctx):
    lab = data.LABS[slug]
    lines = ["Comandos sugeridos para este laboratório:", ""]
    for c in lab["comandos"]:
        lines.append("  $ " + c)
    lines += ["", "Comandos básicos: clear, help, pwd, whoami, ls, cat <arquivo>"]
    if slug == "loupe":
        lines += ["Dica: enumere com 'id', 'sudo -l' e 'find / -perm -4000 2>/dev/null'."]
    return lines


# ── PINGO VERDE ─────────────────────────────────────────────────────────────
def _pingo(line, ctx):
    p = line.split()
    head = p[0].lower()
    if head == "whois":
        return [
            "Domain Name: PINGOVERDE.COM.BR",
            "Owner: Pingo Verde Comercio LTDA",
            "Country: BR",
            "Created: 2019-03-11",
            "Name Server: ns1.pingoverde.com.br",
            "Name Server: ns2.pingoverde.com.br",
            "DNSSEC: unsigned",
            "",
            "[!] O servidor ns1 responde a transferência de zona? Tente consultas DNS.",
        ]
    if head == "dig":
        target = " ".join(p[1:]).lower()
        if "txt" in target and "dev" in target:
            return [
                "; <<>> DiG 9.18 <<>> txt dev.pingoverde.com.br",
                ";; ANSWER SECTION:",
                'dev.pingoverde.com.br. 300 IN TXT "ambiente=staging" "flag=SOLYD{dns_txt_r3c0n}"',
                "",
                "[+] Flag encontrada no registro TXT!",
            ]
        if "dev" in target:
            return [
                ";; ANSWER SECTION:",
                "dev.pingoverde.com.br. 300 IN A 10.10.10.43",
                "",
                "[*] Ambiente de desenvolvimento identificado. Consulte o TXT.",
            ]
        return [
            "; <<>> DiG 9.18 <<>> pingoverde.com.br ANY",
            ";; ANSWER SECTION:",
            "pingoverde.com.br.    300  IN  A      10.10.10.42",
            "pingoverde.com.br.    300  IN  MX     10 mail.pingoverde.com.br.",
            "pingoverde.com.br.    300  IN  NS     ns1.pingoverde.com.br.",
            "dev.pingoverde.com.br. 300 IN  A      10.10.10.43",
            "dev.pingoverde.com.br. 300 IN  TXT    \"flag=SOLYD{dns_txt_r3c0n}\"",
            "",
            "[+] Registros interessantes encontrados: dev.pingoverde.com.br",
        ]
    if head == "gobuster":
        return [
            "===============================================================",
            "Gobuster v3.6  |  mode: dir  |  url: http://pingoverde.com.br",
            "===============================================================",
            "/assets               (Status: 301) [--> /assets/]",
            "/robots.txt           (Status: 200) [Size: 84]",
            "/backup               (Status: 301) [--> /backup/]",
            "/admin                (Status: 403) [Size: 162]",
            "/.git                 (Status: 301) [--> /.git/]",
            "",
            "[*] 5 resultados. O diretório /backup parece promissor.",
        ]
    if head == "curl":
        url = line.lower()
        if "config.bak" in url:
            return [
                "HTTP/1.1 200 OK",
                "Server: nginx/1.18.0",
                "Content-Type: application/octet-stream",
                "",
                "# Pingo Verde - backup de configuração (NÃO PUBLICAR)",
                "DB_HOST=db-internal.pingoverde.com.br",
                "DB_USER=pingo_app",
                "DB_PASS=Verde@2023!",
                "PAYMENT_KEY=live_9f2b...",
                "FLAG=SOLYD{b4ckup_c0nf1g_l34k}",
                "",
                "[+] Flag capturada do backup exposto.",
            ]
        if "robots.txt" in url:
            return ["User-agent: *", "Disallow: /backup/", "Disallow: /admin/", "Disallow: /.git/"]
        if "dev.pingoverde" in url:
            return [
                "HTTP/1.1 200 OK",
                "Server: nginx/1.18.0",
                "",
                "<title>Pingo Verde • Staging</title>",
                "<h1>Ambiente de desenvolvimento</h1>",
                "<p>Build 2023.11 • acesso restrito</p>",
                "<!-- TODO: remover backup de config antes do deploy -->",
            ]
        if "/backup" in url:
            return ["<title>Index of /backup</title>", "config.bak", "dump_2023.sql.gz", "notas.txt"]
        return [
            "HTTP/1.1 200 OK",
            "Server: nginx/1.18.0",
            "",
            "<title>Pingo Verde — Hardware & Jardim</title>",
            "<h1>O verde que combina com você</h1>",
            "<!-- deploy: 2023.11.03 - equipe infra -->",
        ]
    if head == "ls":
        return ["notes.txt  wordlists/  scans/"]
    if head == "cat":
        return [
            "Anotações de recon:",
            "- sempre começar por whois e DNS",
            "- gobuster com raft-medium.txt",
            "- não esquecer de /backup e robots.txt",
        ]
    if head == "nmap":
        return ["Host 10.10.10.42 is up.", "80/tcp  open  http   nginx 1.18.0", "443/tcp open  https  nginx 1.18.0"]
    return _unknown(line)


# ── MERIDIANO ───────────────────────────────────────────────────────────────
def _meridiano(line, ctx):
    p = line.split()
    head = p[0].lower()
    if head == "nmap":
        if "-p-" in line:
            return [
                "Starting Nmap 7.94 ( https://nmap.org )",
                "Nmap scan report for meridiano-legacy (10.10.20.15)",
                "PORT     STATE SERVICE     VERSION",
                "22/tcp   open  ssh         OpenSSH 7.6p1 Ubuntu",
                "80/tcp   open  http        nginx 1.14.0",
                "8080/tcp open  http        Apache Tomcat 9.0.30",
                "3306/tcp open  mysql       MySQL 5.7.33",
                "",
                "Nmap done: 1 IP address (1 host up) scanned in 18.42 seconds",
            ]
        return [
            "Starting Nmap 7.94 ( https://nmap.org )",
            "Nmap scan report for meridiano-legacy (10.10.20.15)",
            "PORT     STATE SERVICE     VERSION",
            "22/tcp   open  ssh         OpenSSH 7.6p1 Ubuntu",
            "80/tcp   open  http        nginx 1.14.0",
            "8080/tcp open  http        Apache Tomcat 9.0.30",
            "3306/tcp open  mysql       MySQL 5.7.33",
            "|_http-title: Meridiano Network Monitor",
            "|_http-server-header: Apache-Coyote/1.1  SOLYD{t0mc4t_l3g4cy_b4nn3r}",
            "",
            "[!] Tomcat 9.0.30 legado identificado na porta 8080.",
            "[+] Flag do banner capturada!",
        ]
    if head == "curl":
        if "/ping?" in line:
            host = line.split("host=")[-1].strip("'\" ")
            host = host.split("&")[0]
            injected = ";" in host or "|" in host or "`" in host
            if injected:
                sub = re.split(r"[;|`]", host, 1)[-1].strip()
                if sub.startswith("cat /opt/flag.txt"):
                    return ["PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.", "", "SOLYD{c0mm4nd_1nj3ct10n}", "", "[+] Comando injetado como www-data."]
                if sub.startswith("id"):
                    return ["PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.", "", "uid=33(www-data) gid=33(www-data) groups=33(www-data)", "", "[+] A entrada é concatenada no shell. Agora leia /opt/flag.txt."]
                return ["PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.", "", f"sh: {sub}: command executed as www-data"]
            return [
                "HTTP/1.1 200 OK",
                "Content-Type: text/html",
                "",
                "<h2>Resultado do ping para " + host + "</h2>",
                "PING " + host + ": 4 packets transmitted, 4 received",
            ]
        if ":8080" in line:
            return [
                "HTTP/1.1 200 OK",
                "Server: Apache-Coyote/1.1",
                "",
                "<title>Meridiano Network Monitor</title>",
                "<h1>Monitor de Rede v0.9-beta</h1>",
                "<form action='/ping'><input name='host' placeholder='127.0.0.1'><button>Pingar</button></form>",
                "<!-- servidor legado, não atualizar -->",
                "<!-- banner: SOLYD{t0mc4t_l3g4cy_b4nn3r} -->",
            ]
        return ["HTTP/1.1 200 OK", "Server: nginx/1.14.0", "", "<title>Grupo Meridiano</title>", "<h1>Meridiano Group</h1>"]
    if head == "gobuster":
        return ["/manager              (Status: 302) [--> /manager/html]", "/docs                 (Status: 200)", "/ping                 (Status: 200)"]
    if head == "mysql":
        return ["ERROR 1045 (28000): Access denied for user 'root'@'10.10.20.15'"]
    if head == "ls":
        return ["notes.txt  scans/  exploits/"]
    if head == "cat":
        return ["Notas: Tomcat 9.0.30 na 8080. Aplicação de ping usa Runtime.exec() com input do usuário."]
    return _unknown(line)


# ── THE LOUPE ───────────────────────────────────────────────────────────────
LOUPE_FS = {
    "/var/www/loupe": ["index.php", "upload.php", "uploads/", "backup/"],
    "/var/www/loupe/uploads": ["pauta.php", "logo.png"],
    "/var/www/loupe/backup": ["pautas.zip", "config.php"],
    "/home/www-data": ["user.txt"],
    "/etc": ["passwd", "hostname", "shadow"],
    "/usr/local/bin": ["loupe-backup"],
    "/root": ["root.txt", ".bash_history"],
}


def _loupe(line, ctx):
    p = line.split()
    head = p[0].lower()
    root = ctx.get("root", False)
    cwd = ctx.get("cwd", "/var/www/loupe")

    if head == "id":
        return ["uid=33(www-data) gid=33(www-data) groups=33(www-data)"] if not root else ["uid=0(root) gid=0(root) groups=0(root)"]
    if head == "ls":
        target = p[1] if len(p) > 1 else cwd
        if target.startswith("~"):
            target = "/home/www-data"
        target = target.rstrip("/") or "/"
        if target == "/root" and not root:
            return ["ls: cannot open directory '/root': Permission denied"]
        if target in ("/", "/var", "/home", "/usr", "/var/www", "/usr/local"):
            return ["bin  etc  home  root  tmp  usr  var"]
        entries = LOUPE_FS.get(target)
        if not entries:
            return [f"ls: cannot access '{target}': No such file or directory"]
        return ["  ".join(entries)]
    if head == "cd":
        target = p[1] if len(p) > 1 else "/var/www/loupe"
        if target.startswith("~"):
            target = "/home/www-data"
        if not target.startswith("/"):
            target = (cwd.rstrip("/") + "/" + target).replace("//", "/")
        target = target.rstrip("/") or "/"
        if target == "/root" and not root:
            return ["bash: cd: /root: Permission denied"]
        ctx["cwd"] = target
        return []
    if head == "cat":
        target = " ".join(p[1:])
        if "user.txt" in target:
            return ["SOLYD{us3r_www_d4t4}", "", "[+] Flag de usuário capturada."]
        if "root.txt" in target:
            if not root:
                return ["cat: /root/root.txt: Permission denied"]
            return ["SOLYD{r00t_3sc4l4t10n}", "", "[+] Você é root. A rede está comprometida."]
        if "passwd" in target:
            return ["root:x:0:0:root:/root:/bin/bash", "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin", "loupe:x:1001:1001:The Loupe:/home/loupe:/bin/bash"]
        if "config.php" in target:
            return ["<?php", "$db_host='127.0.0.1'; $db_user='loupe'; $db_pass='p4p1r0_2021';", "?>"]
        if "notes.txt" in target or "notes" in target:
            return ["- backup automatizado roda como root", "- binário /usr/local/bin/loupe-backup tem SUID", "- opção --restore abre shell de manutenção"]
        return [f"cat: {target}: No such file or directory"]
    if head == "sudo":
        if "-l" in line:
            return [
                "Matching Defaults entries for www-data on loupe:",
                "    env_reset, mail_badpass, secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "",
                "User www-data may run the following commands on loupe:",
                "    (root) NOPASSWD: /usr/local/bin/loupe-backup",
            ]
        if "loupe-backup" in line:
            return _escalate(ctx)
        return ["usage: sudo [-l] [comando]"]
    if head == "find":
        if "-perm" in line or "4000" in line:
            return [
                "/usr/bin/passwd",
                "/usr/bin/sudo",
                "/usr/local/bin/loupe-backup",
                "",
                "[!] loupe-backup tem SUID e pertence a root.",
            ]
        return ["/var/www/loupe/index.php", "/var/www/loupe/upload.php", "/home/www-data/user.txt"]
    if head in ("loupe-backup", "./loupe-backup"):
        if "--restore" in line:
            return _escalate(ctx)
        return ["loupe-backup 1.0 — backup do acervo", "Uso: loupe-backup [--restore]"]
    if head == "uname":
        return ["Linux loupe 5.4.0-150-generic #167-Ubuntu SMP x86_64 GNU/Linux"]
    if head == "grep":
        return ["(sem resultados)"]
    if head == "python3" or head == "python":
        return ["Python 3.8.10"]
    if head == "lsattr" or head == "getcap":
        return ["(nenhuma capability interessante)"]
    if head == "help":
        return _help("loupe", ctx)
    return _unknown(line)


def _escalate(ctx):
    if ctx.get("root"):
        return ["Você já é root.", "[*] Leia /root/root.txt"]
    ctx["root"] = True
    return [
        "loupe-backup: iniciando restauração do acervo...",
        "loupe-backup: montando volumes como root...",
        "root@loupe:/root# echo 'shell de manutenção aberta'",
        "",
        "[+] Escalação de privilégios concluída. Você agora é root.",
        "[*] Tente: cat /root/root.txt",
    ]


# ── LABS WEB ────────────────────────────────────────────────────────────────
def _web(slug, line, ctx):
    p = line.split()
    head = p[0].lower()
    lab = data.LABS[slug]

    if head == "nmap":
        lines = ["Starting Nmap 7.94 ( https://nmap.org )", f"Nmap scan report for {lab['nome'].lower().replace(' ', '-')} ({lab['ip']})", "PORT     STATE SERVICE   VERSION"]
        for s in lab["servicos"]:
            parts = s.split("/", 1)
            port = parts[0]
            rest = parts[1] if len(parts) > 1 else ""
            lines.append(f"{port:<8} open  {rest}")
        lines += ["", "Nmap done: 1 IP address (1 host up) scanned."]
        return lines

    if head == "curl":
        low = line.lower()
        if slug == "eletroninja":
            if "/admin" in low:
                return ["HTTP/1.1 302 Found", "Location: /login", "", "[*] Faça o bypass pelo formulário na aba Aplicação alvo."]
            if "/search" in low or "q=" in low:
                return ["HTTP/1.1 200 OK", "", "<h1>Resultados da busca</h1>", "<p>0 produtos encontrados para o termo.</p>", "<!-- query: SELECT id,name,price FROM products WHERE name LIKE '%<termo>%' -->"]
            return ["HTTP/1.1 200 OK", "Server: nginx/1.18.0", "", "<title>EletroNinja — Componentes para makers</title>", "<h1>EletroNinja</h1>", "<form action='/login' method='post'>", "<!-- login monta SQL por concatenação -->"]
        if slug == "shoutbox":
            return ["HTTP/1.1 200 OK", "Server: Express", "", "<title>ShoutBox</title>", "<h1>Mural de recados</h1>", "<!-- mensagens renderizadas sem escape -->"]
        if slug == "papiro":
            if "file=" in low:
                if "secret/flag.txt" in low and "....//" in low:
                    return ["HTTP/1.1 200 OK", "", "SOLYD{lfi_p4th_tr4v3rs4l}", "", "[+] Path traversal funcionou também pelo terminal."]
                return ["HTTP/1.1 200 OK", "", "<h1>Livraria Papiro</h1><p>Arquivo não encontrado.</p>"]
            if "uploads/" in low and ".php" in low:
                if "root_flag" in low:
                    return ["HTTP/1.1 200 OK", "", "SOLYD{w3bsh3ll_upl04d3d}"]
                return ["HTTP/1.1 200 OK", "", "uid=33(www-data) gid=33(www-data) groups=33(www-data)"]
            return ["HTTP/1.1 200 OK", "Server: Apache/2.4.41 (Ubuntu)", "", "<title>Livraria Papiro</title>", "<h1>Acervo digital</h1>"]
        if slug == "instagrao":
            if "169.254.169.254" in low:
                return [
                    "HTTP/1.1 200 OK",
                    "",
                    '{"Code":"Success","AccessKeyId":"ASIA...","SecretAccessKey":"...","Token":"...","Flag":"SOLYD{ssrf_m3t4d4t4}"}',
                    "",
                    "[+] O importador buscou a metadata interna.",
                ]
            m = re.search(r"/api/user/(\d+)", low)
            if m:
                uid = m.group(1)
                if uid == "1":
                    return ['HTTP/1.1 200 OK', "", '{"id":1,"username":"admin","private_dm":"SOLYD{1d0r_pr1v4t3_dm}"}', "", "[+] IDOR confirmado: a API não valida o dono do recurso."]
                return ['HTTP/1.1 200 OK', "", '{"id":2,"username":"bruno","bio":"fotografia e café"}']
            return ["HTTP/1.1 200 OK", "", "<title>Instagrão</title>", "<h1>Compartilhe momentos</h1>"]
        if slug == "echo-llm":
            return ["HTTP/1.1 200 OK", "", "<title>Echo — Assistente financeira</title>", "<p>A Echo está online. Use a aba Aplicação alvo para conversar.</p>"]
        if slug == "meridiano":
            return _meridiano(line, ctx)
        return ["HTTP/1.1 404 Not Found"]

    if head == "sqlmap":
        if slug == "eletroninja":
            return [
                "        ___",
                "       __H__",
                " ___ ___[.]_____ ___ ___  {1.7.10#stable}",
                "|_ -| . [']     | .'| . |",
                "|___|_  [)]_|_|_|__,|  _|",
                "      |_|V...       |_|   https://sqlmap.org",
                "",
                "[INFO] testing connection to the target URL",
                "[INFO] POST parameter 'username' appears to be 'MySQL >= 5.0 AND error-based' injectable",
                "[INFO] POST parameter 'password' appears to be injectable",
                "[WARNING] sqlmap é ótimo para automatizar, mas aqui o objetivo é entender o payload.",
                "[*] Tente manualmente na aba Aplicação alvo: ' OR 1=1 -- ",
            ]
        return ["[INFO] nenhum parâmetro injetável encontrado com a wordlist padrão.", "[*] Talvez a falha esteja em outro lugar."]

    if head == "ls":
        return ["notes.txt  exploit.py  wordlists/"]
    if head == "cat":
        return ["- explore a aplicação alvo na aba ao lado", "- leia as dicas de cada objetivo", "- o terminal é simulado; a aplicação é real"]
    if head == "ping":
        host = p[1] if len(p) > 1 else "127.0.0.1"
        return [f"PING {host} (10.10.20.0) 56(84) bytes of data.", "64 bytes: icmp_seq=1 ttl=64 time=0.041 ms", "64 bytes: icmp_seq=2 ttl=64 time=0.038 ms"]
    return _unknown(line)


def _unknown(line):
    return [f"bash: {line.split()[0]}: command not found", "Digite 'help' para ver os comandos disponíveis."]
