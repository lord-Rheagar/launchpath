# Launchpath

Launchpath helps developers understand how to set up an OAuth integration and prepare it for launch. Search the prepared GitHub, Slack, and Gmail guides, or enter another app to generate a guide from its documentation and Composio's documentation.

**Live app:** [launchpath-ppx6.onrender.com](https://launchpath-ppx6.onrender.com/)

The live app runs on Render's free plan. It may take a minute to wake up after inactivity. Generated guides are temporary, so download them as Markdown before leaving.

## What it does

- Searches public documentation and reads relevant pages.
- Creates a guide covering setup, permissions, testing, approval, blockers, and next steps.
- Shows the sources, supporting passages, and unresolved questions behind a guide.
- Lets you download a guide as a Markdown file.
- Provides prepared guides for GitHub, Slack, and Gmail without an API key.

## Run locally

You need [Node.js 22 or newer](https://nodejs.org/) and an OpenRouter API key with available credits for new research. Prepared guides work without a key.

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/lord-Rheagar/launchpath.git
   cd launchpath
   npm ci
   ```

2. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

   In PowerShell, use `Copy-Item .env.example .env` instead.

3. Open `.env` and set `OPENROUTER_API_KEY` to your key. Keep the key private and never commit `.env`.

4. Start the app:

   ```bash
   npm start
   ```

5. Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Enter an app name, start research, and use **Download Markdown** when the guide is ready.

Restart the server after changing `.env`. Use `npm run dev` for automatic restarts during development.

## Configuration

The full list of settings and defaults is in [.env.example](.env.example). The most useful settings are:

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Enables research through OpenRouter. Model and search requests use your account credits. |
| `OPENROUTER_MODEL` | Selects the primary model. The example file contains the current default. |
| `OPENROUTER_FALLBACK_MODEL` | Selects the fallback model; set to `none` to disable it. |
| `TAVILY_API_KEY` | Optional key for independent search and document extraction. |
| `AI_PROVIDER` | Set to `openrouter` or `deepseek`; `auto` chooses OpenRouter when its key is set. |
| `HOST`, `PORT` | Control where the server listens. Local defaults are `127.0.0.1` and `3000`. |
| `DATA_DIR` | Directory for research runs and generated guides. Defaults to `./data`. |
| `RESEARCH_PASSWORD` | Optional shared password for starting research. Leave unset for open access. Guide links remain public. |

Direct DeepSeek is an alternative: set `AI_PROVIDER=deepseek` and `DEEPSEEK_API_KEY`. Its strict-schema compatibility has not been verified live. Model and search availability, limits, and charges depend on the provider and account.

## How it works

1. The Node.js server accepts the app name and creates a research job.
2. A background worker searches and reads public documentation, then checks which topics have supporting evidence.
3. The model writes and reviews the guide in sections. The app validates the results and identifies gaps or conflicts.
4. The browser displays the guide and its sources. The user can download a Markdown copy.

The frontend is plain HTML, CSS, and JavaScript. The backend uses Node.js and stores jobs, sources, and guides as JSON files in `DATA_DIR`. No database is required for the current single-server setup.

## Key decisions

- **Evidence before answers:** The app saves retrieved passages and links guide claims to them. It shows unknowns and conflicting evidence rather than treating missing information as proof.
- **Practical default guide:** A run starts with a general OAuth setup and approval brief. It explains differences in audience and permissions in the guide instead of requiring a long questionnaire.
- **Background work:** Research runs outside the request that starts it, and the browser polls for progress. Up to two jobs run at once. Checkpoints can help a run resume after a restart if its data directory is preserved.
- **Simple storage and deployment:** A single Node.js process and local files make the app easy to run. This design is intended for one server instance.
- **Server-side credentials:** Model and search keys stay on the server. Research requests have an optional shared password and an in-memory rate limit.

## Deploy on Render

Connect the repository and create a **Web Service** using Node.js 22 or newer:

| Setting | Value |
| --- | --- |
| Build command | `npm ci` |
| Start command | `npm start` |
| Environment variables | `HOST=0.0.0.0`, `NODE_VERSION=22`, and `OPENROUTER_API_KEY` |

Render supplies `PORT`. Leave `RESEARCH_PASSWORD` unset for password-free research, or set it to restrict who can start runs. Never put API keys in the repository or browser code.

The free service has temporary storage. A sleep, restart, or redeploy can delete generated guides and in-progress research; downloaded files remain on the user's device. To keep server-side data across restarts, use a paid service with a persistent disk and set `DATA_DIR` to its mount path. Run only one instance with the current file store.

## Limitations

- **Review generated guidance.** A guide can be partial, outdated, or incorrect. Check its sources and unresolved questions before relying on it.
- **Research is not a real setup.** The app reads public pages; it does not sign in, create provider accounts, submit forms, or verify an actual OAuth connection.
- **Some pages cannot be read.** Login-protected pages, interactive consoles, PDFs, and JavaScript-only content may be unavailable or incomplete. Optional Tavily extraction may help but is not guaranteed.
- **Runs take time and cost money.** A detailed run can take several minutes. AI and search calls may incur charges, including calls that time out. The exact cost per guide has not been established.
- **Free hosting is temporary.** Guide links and in-progress work can be lost when Render's free instance sleeps or restarts. Download the guide to keep a copy.
- **Capacity is limited.** The file store and worker are designed for one instance, not horizontal scaling. The in-memory rate limit resets on restart and can treat users behind a proxy as one client; it is not a complete public abuse or spending control.
- **Markdown is an export, not the full audit record.** The in-app view contains source and evidence details that may not all appear in the downloaded guide.

## Tests

```bash
npm run check
```

This checks JavaScript syntax and runs the automated tests. Tests use controlled fixtures; a live research test also requires a funded API key and network access.

See [VALIDATION.md](VALIDATION.md) for previous validation notes and [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md) for the broader product scope.
