# Next.js UI image.
#
# Uses output: "standalone" (next.config.ts), so the runtime stage ships the
# traced server and its traced node_modules rather than a full install.

# ---------------------------------------------------------------- dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ----------------------------------------------------------------------- build
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY next.config.ts tsconfig.json postcss.config.mjs next-env.d.ts ./
COPY public ./public
COPY src ./src

# NEXT_PUBLIC_ variables are inlined into the client bundle during the build, so
# this is a build argument rather than a runtime environment variable. It must
# be the URL the *browser* will use — the published host port, not the compose
# service name, which does not resolve outside the Docker network.
#
# Consequence worth knowing: changing it requires rebuilding this image. The
# server-side counterpart (INTERNAL_API_BASE_URL) is read at runtime and can be
# changed without a rebuild.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --------------------------------------------------------------------- runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# server.js binds to localhost by default, which inside a container means the
# container itself and makes the published port answer nothing.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The standalone server does not include these two directories, so they are
# copied in alongside it — otherwise every static asset and image 404s.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "server.js"]
