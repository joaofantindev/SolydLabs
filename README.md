# SOLYD // LABS

Plataforma **local** de treinamento ofensivo inspirada em Solyd, TryHackMe e Hack The Box.
Reúne todas as trilhas e certificações do ecossistema Solyd, aulas navegáveis e **8 laboratórios
práticos** com máquinas virtuais simuladas, terminal web e aplicações-alvo intencionalmente
vulneráveis — tudo rodando na sua máquina, sem depender de internet.

> ⚠️ **Ambiente didático e isolado.** As aplicações em `/target/*` são deliberadamente inseguras
> (SQLi, XSS, LFI, IDOR, SSRF, command injection, prompt injection). Elas escutam apenas em
> `127.0.0.1`, usam bancos descartáveis e **nunca devem ser expostas à internet** nem reutilizadas
> como base para sistemas reais.

---

## Sumário

- [O que tem dentro](#o-que-tem-dentro)
- [Requisitos](#requisitos)
- [Como rodar](#como-rodar)
- [Como usar](#como-usar)
- [Laboratórios](#laboratórios)
- [Fluxo de uma sala](#fluxo-de-uma-sala)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Segurança](#segurança)
- [Solução rápida das flags](#solução-rápida-das-flags)
- [Personalização](#personalização)
- [Solução de problemas](#solução-de-problemas)

---

## O que tem dentro

| Área | Conteúdo |
| --- | --- |
| **8 trilhas** | Absoluto Zero, Pentest Web, Infra & Red Team, Wireless Hacking, Mobile Android, Hardware Hacking, Evasion & Malware, Cloud & Especializações |
| **37 cursos** | Do primeiro contato com Linux até evasão de antivírus, com ementa, duração, nível e módulos |
| **5 certificações** | SYCP, SYWP, SYH2, SYAP, SYES — com trilhas, labs e critérios de aprovação |
| **8 labs** | VMs simuladas com boot animado, terminal, alvo web em iframe e captura de flags |
| **Progressão** | XP, níveis (Script Kiddie → Red Team Operator), flags, ranking e retomada de estudos |
| **Interface** | Tema escuro vermelho (estilo HTB), responsivo, paleta de comandos (`Ctrl+K`) e toasts |

### Níveis de progressão

| XP | Nível |
| --- | --- |
| 0 | Script Kiddie |
| 500 | Recon Rookie |
| 1.200 | Pentester Júnior |
| 2.200 | Hacker de Elite |
| 3.500 | Red Team Operator |

O progresso (flags, cursos e módulos concluídos) fica no `localStorage` do navegador.
O estado das VMs fica em memória no servidor, por sessão, com TTL de 2 horas.

---

## Requisitos

- **Python 3.10+** (testado em 3.15)
- Flask 3.x (instalado automaticamente pelos scripts)
- Navegador moderno (Chrome, Edge, Firefox ou Safari)
- Nenhuma dependência de CDN: fontes usam fallback do sistema se estiver offline

---

## Como rodar

### Windows — duplo clique

1. Dê dois cliques em **`iniciar.bat`**.
2. O script instala o Flask se necessário, prepara os alvos e abre `http://127.0.0.1:5000`.

### Windows — PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
# outra porta, sem abrir o navegador:
powershell -ExecutionPolicy Bypass -File .\run.ps1 -Port 8000 -NoBrowser
```

### Manual (qualquer sistema)

```bash
python -m pip install -r requirements.txt
python -X utf8 app.py
```

Acesse **http://127.0.0.1:5000**.

Variáveis de ambiente opcionais:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `5000` | Porta do servidor |
| `SOLYD_SECRET` | chave de desenvolvimento | Chave de sessão do Flask |

---

## Como usar

1. **Explore as trilhas** em `/trilhas` e abra um curso em `/curso/<slug>`.
2. **Marque módulos e cursos** como concluídos para ganhar +40 XP por curso e mover o anel de progresso.
3. **Abra um laboratório** em `/labs`, clique em **Iniciar aplicação** e espere o boot simulado.
4. No lab você tem duas abas principais:
   - **Terminal** — comandos simulados (`help` mostra os disponíveis; `↑`/`↓` histórico, `Tab` completa).
   - **Aplicação alvo** — o site vulnerável real em um iframe, quando o lab possui alvo web.
5. **Capture as flags** (`SOLYD{...}`) e valide no painel **Objetivos** à direita.
6. Use **Parar aplicação** para desligar a VM e **Resetar snapshot** para limpar o estado do alvo.

Atalhos:

- `Ctrl+K` (ou `Cmd+K`) — paleta de busca global
- `Esc` — fecha a paleta
- `↑` / `↓` / `Tab` — histórico e autocomplete do terminal

---

## Laboratórios

| # | Lab | Categoria | Vulnerabilidade | Flags |
| --- | --- | --- | --- | --- |
| 1 | **Pingo Verde** | Recon | DNS, diretórios ocultos, backup exposto | 2 |
| 2 | **Meridiano** | Web / Infra | Command injection (Tomcat legado) | 2 |
| 3 | **EletroNinja** | Web | SQL injection (login + UNION) | 2 |
| 4 | **ShoutBox** | Web | XSS armazenado + roubo de cookie | 2 |
| 5 | **Papiro** | Web | Path traversal (LFI) + upload de webshell | 2 |
| 6 | **Instagrão** | Web / Cloud | IDOR + SSRF em metadados | 2 |
| 7 | **The Loupe** | Linux | Enumeração + escalada de privilégios | 2 |
| 8 | **Echo LLM** | IA | Prompt injection + abuso de tool call | 2 |

Os alvos web só respondem **enquanto o lab está em execução**. Fora disso, retornam uma página
`503` explicando como iniciar a VM.

---

## Fluxo de uma sala

```
/labs  →  /lab/<slug>  →  Iniciar aplicação
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
        Terminal simulado               Alvo web (iframe)
     (recon, comandos, pistas)      (SQLi/XSS/LFI/IDOR/SSRF)
              └───────────────┬────────────────┘
                              ▼
                   Flag SOLYD{...} → Validar
                              ▼
                    +XP, objetivo concluído
```

O terminal **não executa nada no sistema operacional real**: toda saída é simulada em Python.
As aplicações-alvo são implementadas em Flask + SQLite descartável e vivem em `/target/<slug>/`.

---

## Estrutura do projeto

```
solydCrack/
├── app.py               # Flask: páginas, APIs dos labs, progresso
├── data.py              # trilhas, cursos, certificações, labs, flags e níveis
├── state.py             # estado das VMs por sessão (TTL 2h)
├── terminal.py          # motor do terminal simulado
├── lab_targets.py       # blueprint /target com os apps vulneráveis
├── requirements.txt
├── iniciar.bat          # atalho Windows (duplo clique)
├── run.ps1              # launcher PowerShell
├── tests/verificar.py   # verificação automatizada (183 checagens)
├── instance/            # criado em runtime: SQLite e arquivos do Papiro
├── static/
│   ├── css/style.css    # design system da plataforma
│   ├── css/target.css   # temas das aplicações-alvo
│   └── js/
│       ├── app.js       # XP, níveis, filtros, paleta, toasts
│       └── lab.js       # VM, terminal, flags, abas, iframe
└── templates/
    ├── base.html, index.html, trilhas.html, trilha.html, curso.html
    ├── labs.html, lab.html, certificacoes.html, certificacao.html
    ├── ranking.html, 404.html, _cards.html, _icons.html
    └── target/          # alvos: ninja, shoutbox, papiro, instagrão, etc.
```

### Principais rotas

| Rota | Descrição |
| --- | --- |
| `GET /` | Home com destaques |
| `GET /trilhas`, `/trilha/<slug>` | Catálogo e detalhe de trilha |
| `GET /curso/<slug>` | Sala de aula / ementa |
| `GET /labs`, `/lab/<slug>` | Catálogo e sala de laboratório |
| `GET /certificacoes`, `/certificacao/<slug>` | Certificações |
| `GET /ranking` | Ranking local |
| `POST /api/lab/<slug>/start` | Sobe a VM simulada |
| `POST /api/lab/<slug>/stop` | Desliga a VM |
| `POST /api/lab/<slug>/reset` | Restaura snapshot |
| `POST /api/lab/<slug>/terminal` | Executa comando simulado |
| `POST /api/lab/<slug>/submit` | Valida uma flag |
| `GET /api/lab/<slug>/state` | Estado, uptime, flags e eventos |
| `GET /api/labs/status` | Quais VMs estão online |
| `GET /api/health` | Health check |
| `GET /target/<slug>/` | Aplicação-alvo (somente com lab online) |

---

## Segurança

- Servidor escuta **somente em `127.0.0.1`**.
- Nenhum comando do terminal é executado no SO real.
- O SQLite e os arquivos do Papiro ficam em `instance/`, recriados a cada execução.
- O alvo web é liberado apenas quando o lab correspondente está com estado `running`.
- O upload do Papiro é **simulado** (não grava PHP executável de verdade).
- O SSRF é **simulado** (não faz requisições reais a `169.254.169.254`).
- Ainda assim: **não exponha esta aplicação na internet**, não a coloque atrás de um proxy público
  e não copie o código dos alvos para projetos reais.

---

## Solução rápida das flags

<details>
<summary>Clique para revelar (contém spoilers)</summary>

| Lab | Flag 1 | Flag 2 |
| --- | --- | --- |
| Pingo Verde | `SOLYD{dns_txt_r3c0n}` | `SOLYD{b4ckup_c0nf1g_l34k}` |
| Meridiano | `SOLYD{t0mc4t_l3g4cy_b4nn3r}` | `SOLYD{c0mm4nd_1nj3ct10n}` |
| EletroNinja | `SOLYD{sqli_bypass_4dm1n}` | `SOLYD{un10n_b4s3d_dump}` |
| ShoutBox | `SOLYD{xss_c00k13_st0l3n}` | `SOLYD{4dm1n_t4k30v3r}` |
| Papiro | `SOLYD{lfi_p4th_tr4v3rs4l}` | `SOLYD{w3bsh3ll_upl04d3d}` |
| Instagrão | `SOLYD{1d0r_pr1v4t3_dm}` | `SOLYD{ssrf_m3t4d4t4}` |
| The Loupe | `SOLYD{us3r_www_d4t4}` | `SOLYD{r00t_3sc4l4t10n}` |
| Echo LLM | `SOLYD{pr0mpt_l34k4g3}` | `SOLYD{t00l_c4ll_4bus3}` |

Caminhos resumidos:

- **Pingo Verde:** `dig txt dev.pingoverde.com.br` e `curl http://pingoverde.com.br/backup/config.bak`
- **Meridiano:** `nmap -sV 10.10.20.15` e `curl 'http://10.10.20.15:8080/ping?host=127.0.0.1;cat /opt/flag.txt'`
- **EletroNinja:** login `admin` / `adm1n_f0rt3` com bypass SQLi; busca com `UNION SELECT` de 3 colunas
- **ShoutBox:** publique `<script>` que envia `document.cookie` para `/target/shoutbox/steal?c=...`;
  use o cookie capturado em `/target/shoutbox/admin`
- **Papiro:** `read?file=....//....//secret/flag.txt` e upload de `shell.php`
- **Instagrão:** `/target/instagrao/api/user/1` e `import?url=http://169.254.169.254/...`
- **The Loupe:** `cat /home/www-data/user.txt`, `loupe-backup --restore`, `cat /root/root.txt`
- **Echo LLM:** peça para revelar as instruções do sistema; abuse da ferramenta `read_file`

</details>

---

## Verificação automatizada

Antes (ou depois) de abrir o navegador, você pode rodar a suíte local:

```bash
python -X utf8 tests/verificar.py
```

Ela sobe o app em memória, percorre todas as páginas, inicia/para cada lab, testa os alvos
online/offline e reproduz os fluxos de SQLi, XSS, LFI/upload, IDOR/SSRF, command injection e
prompt injection. A saída termina com `RESULTADO: 183 ok, 0 falha(s)` quando está tudo certo.

---

## Personalização

- **Cursos/trilhas/certs:** edite `data.py` (`TRILHAS`, `CURSOS`, `CERTIFICACOES`).
- **Labs e flags:** edite `LABS` em `data.py` — cada tarefa tem `titulo`, `desc`, `pontos`, `dica` e `flag`.
- **Níveis:** ajuste `NIVEIS` em `data.py` e o mesmo array é exposto ao JS via `base.html`.
- **Visual:** variáveis CSS no topo de `static/css/style.css`; temas dos alvos em `static/css/target.css`.
- **Novos comandos de terminal:** adicione casos em `terminal.py` e a linha correspondente em `LABS[slug]["comandos"]`.

> Ao adicionar um lab novo, atualize `LAB_ORDER`, crie a entrada em `LABS` e, se houver alvo web,
> registre rotas em `lab_targets.py` e um template em `templates/target/`.

---

## Solução de problemas

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `python` não encontrado | Python fora do PATH | Reinstale marcando *Add python.exe to PATH* |
| Flask não instala | pip desatualizado | `python -m pip install --upgrade pip` |
| Porta 5000 em uso | Outro processo | `set PORT=8000` antes de `python app.py` ou use `run.ps1 -Port 8000` |
| Alvo mostra “Aplicação parada” | VM não iniciada / TTL expirou | Clique em **Iniciar aplicação** novamente |
| Progresso não aparece | `localStorage` bloqueado | Use janela normal (não privada) e permita armazenamento |
| Acentos estranhos no terminal | Console sem UTF-8 | Use `python -X utf8 app.py` ou os scripts fornecidos |
| Reset não limpa o alvo | Cache do iframe | Use **Resetar snapshot** e recarregue a aba do alvo |

---

Feito para estudar segurança de verdade — com ética, curiosidade e um ambiente que nunca machuca
ninguém fora da sua própria máquina.
