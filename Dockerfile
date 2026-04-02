FROM node:20-bullseye-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
RUN npm ci --include=dev

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json addExtensions.mjs ./
RUN npm run prisma:generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
RUN groupadd -r app && useradd -r -g app -u 1001 app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app prisma ./prisma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const n=require('net');const p=process.env.PORT||3000;const s=n.connect(p,'127.0.0.1');s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),4000);"
USER app
CMD ["node", "dist/server.js"]
