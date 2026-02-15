# Dockerfile for ide.orcest.ai (VS Code fork) - Render.com deploy
# Requires X11 libs for native-keymap, node-pty, etc.

FROM node:20-bookworm-slim

# Install build deps for native modules (native-keymap, node-pty, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libxkbfile-dev \
    libx11-dev \
    libxrandr-dev \
    libxi-dev \
    libxtst-dev \
    libxrender-dev \
    libxfixes-dev \
    libxext-dev \
    libxkbcommon-dev \
    libsecret-1-dev \
    libkrb5-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source (postinstall needs full tree for build/, remote/, etc.)
COPY . .

# Install deps - requires X11 libs above for native-keymap, node-pty
RUN npm i

# Build the web version
ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN npm run compile-web

# Render sets PORT env
EXPOSE 10000
CMD ["sh", "-c", "node scripts/code-web.js --host 0.0.0.0 --port ${PORT:-10000} --browserType none"]
