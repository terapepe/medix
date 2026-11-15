<p align="center"><img src="assets/wordmark.svg" width="420" alt="medix — MEDCORE OS"></p>

# MEDCORE OS — medix.wiki

A medical-AI operations core shipped as an operating system that runs in the browser.
Boot sequence → operator login → ACCESS GRANTED → a desktop of layered terminal windows.
Every feature is an application launched by a command.

Static site: HTML / CSS / vanilla JS. No build step, no backend. Works on GitHub Pages, Vercel, Netlify, Hostinger or any static host.

- Token: **medix** · Symbol: **$MDX**
- X: [@medixwiki](https://x.com/medixwiki)

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000      (add ?noboot to skip the boot sequence)
```

## MEDIX AI (chat) — Vercel environment variables

`medix` / `chat` opens the AI window. The browser talks to `api/chat.js` (Vercel serverless), which calls the Claude API — the key never reaches the client. The AI reads project facts from `js/config.js` and fetches live data through tools (token market, network status, ICD-10, conditions, FDA labels/recalls, PubMed, calculators, open windows).

Set in **Vercel → Project → Settings → Environment Variables**, then redeploy:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **yes** | — | Claude API key (console.anthropic.com) |
| `MEDIX_MODEL` | no | `claude-sonnet-5-5` | e.g. `claude-haiku-5-5` for lower cost |
| `MEDIX_MAX_TOKENS` | no | `1024` | Max tokens per reply (cap 4096) |
| `MEDIX_RATE_LIMIT` | no | `40` | Requests per IP per hour (per function instance) |
| `MEDIX_ALLOWED_ORIGINS` | no | `https://medix.wiki,https://www.medix.wiki` | Sites allowed to call `/api/chat` (add your `*.vercel.app` preview URL if needed) |

Check: `GET https://medix.wiki/api/chat` → `{"ok":true,"configured":true}`.

## Configuration — `js/config.js`

Everything that may change later is in one file:

| Key | Purpose |
|---|---|
| `token.name` / `token.symbol` | Token name and symbol |
| `token.evm` | EVM contract address — shared by Robinhood, Base and BSC |
| `token.sol` | Solana mint address |
| `social.x` / `social.xHandle` | X account |
| `mode` | `"single"` → one network · `"multi"` → always all 4 (Solana, Robinhood, Base, BSC) |
| `singleNetwork` | `solana` \| `robinhood` \| `base` \| `bsc` — the whole OS re-themes to that network |
| `multiOrder` | Network order in multi mode |
| `networks.<id>` | Name, colors, icon, RPC, explorer, DexScreener chain id, boot uplink label |
| `theme` | Accent colors used in multi mode |
| `brand.*` | Brand / OS name, version, domain, tagline |
| `boot`, `fx` | Boot sequence, CRT, flicker, matrix rain, glitch defaults |
| `autostart` | Apps opened beside the terminal on desktop |
| `data.*` | API endpoints, refresh interval, timeouts |

While a CA is empty the UI shows **PENDING DEPLOYMENT** and copy buttons are disabled.

### Where the CA is shown (with network icon + COPY)

1. Top system bar (always visible)
2. `ca` — contract registry window (+ explorer links); `ca copy <net>` copies from the shell
3. `token` — token dashboard header
4. `docs token`

## Commands

| Group | Commands |
|---|---|
| Apps | `medix [question\|reset]`, `docs [section]`, `token`, `ca`, `sysmon`, `logs`, `config` |
| Token | `token`, `ca [copy] [net]`, `net`, `scan <wallet>` |
| Medical | `icd <term>`, `cond <condition>`, `drug <name>`, `recall <drug>`, `pubmed <query>`, `calc <bmi\|bsa\|map\|egfr> …` |
| System | `help`, `clear`, `login <callsign>`, `history`, `ls`, `open`, `close`, `ps`, `whoami`, `date`, `neofetch`, `diag`, `x`, `reboot` |
| FX | `matrix [on\|off\|burst]`, `fx <crt\|flicker\|glitch> [on\|off]` |

TAB autocomplete · ↑/↓ history · Ctrl+L clear · `;` chains commands · Ctrl+K focuses the terminal.
Deep links: `?app=docs`, `#token`, `?app=icd-asthma`.

## Data sources (all live, no demo data)

| Module | Source |
|---|---|
| Token dashboard | DexScreener `tokens/v1/{chain}/{ca}` + on-chain RPC (`totalSupply`, `getTokenSupply`) |
| `net`, boot handshake | Network RPC (`eth_blockNumber` / `getSlot`) |
| `scan` | On-chain `balanceOf` / `getTokenAccountsByOwner` |
| `icd`, `cond` | NLM Clinical Tables (ICD-10-CM, Conditions) |
| `drug`, `recall` | openFDA (drug label, enforcement) |
| `pubmed` | NCBI E-utilities |

If a source is unreachable the OS reports the failure — nothing is faked.

## Structure

```
index.html
css/os.css                 terminal / CRT skin, windows, mobile
js/config.js               ALL editable settings
js/core/utils.js           helpers, kernel log, brand mark
js/core/chain.js           networks, CA groups, RPC, DexScreener
js/core/fx.js              matrix rain, CRT, glitch, typing, decode
js/core/wm.js              window manager (drag, resize, min/max/close, tmux bar)
js/core/shell.js           command shell + built-ins
js/core/boot.js            boot sequence + login
js/apps/*.js               token, medical, system, docs, ai (MEDIX AI) modules
api/chat.js                Vercel function: Claude API proxy (system prompt, tools, rate limit)
vercel.json                function settings (bundles js/config.js)
assets/                    logo, wordmark, favicon, og image, network icons
```

Adding a command: `Shell.reg("name", { group, usage, desc, run(args, sh) {} })`.
Adding a window app: `Shell.app("name", { desc, open(args) { WM.open(...) } })`.

## Disclaimer

Medical modules return reference data from public datasets — not medical advice. Token data is informational — not financial advice.
