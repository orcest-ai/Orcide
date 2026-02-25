# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Orcide is an AI-powered Cloud IDE (VS Code fork) by Orcest AI. It runs as both an Electron desktop app and a web server. In Cloud Agent environments (headless), use the **web server mode**.

### Node.js version
The project requires **Node.js 20.18.2** (see `.nvmrc`). The environment uses nvm; run `source ~/.nvm/nvm.sh && nvm use` before commands if needed.

### Key commands
All scripts are in `package.json`. Key ones:

| Task | Command |
|---|---|
| Install deps | `npm install` (also runs postinstall for all subdirectories) |
| Build React UI | `npm run buildreact` |
| Compile TS | `npm run compile` |
| Watch mode | `npm run watch` |
| Lint (ESLint) | `npm run eslint` |
| Lint (Stylelint) | `npm run stylelint` |
| Unit tests (Node) | `npm run test-node` |
| Unit tests (Browser) | `npm run test-browser` |
| Start web server | `NODE_ENV=development VSCODE_DEV=1 node out/server-main.js --port 9888 --without-connection-token` |

### Running the web server (headless)
Do **not** use `./scripts/code-server.sh` in Cloud Agent environments — it calls `preLaunch.js` which downloads Electron binaries unnecessarily. Instead, after compiling:
```
NODE_ENV=development VSCODE_DEV=1 node out/server-main.js --port 9888 --without-connection-token
```
The IDE will be available at `http://localhost:9888`.

### Gotchas
- `.npmrc` targets Electron headers (`runtime="electron"`, `target="34.3.2"`). Native modules are built against Electron, not plain Node.js. This is expected.
- `npm install` runs a `postinstall` hook that installs dependencies in ~30 subdirectories (extensions, build, remote, test dirs). This takes several minutes.
- ESLint is run via a custom Gulp wrapper (`npm run eslint`), not the standard `npx eslint` CLI. The wrapper treats warnings as errors.
- System dependencies required for native module compilation: `libxkbfile-dev`, `libx11-dev`, `libsecret-1-dev`, `libkrb5-dev`, `python3`, `make`, `g++`, `pkg-config`.
- The React build (`npm run buildreact`) must run before `npm run compile` if React UI components have changed; the build output is consumed by the main compilation.
- No external databases or Docker services are required to run the IDE in development.
