# Express API image.
#
# Multi-stage so the build toolchain (typescript, tsx, the Prisma CLI) stays out
# of the runtime image, which ends up with production dependencies and compiled
# JavaScript only.

# ---------------------------------------------------------------- dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Copied before the source so this layer is cached on every change that is not a
# dependency change — which is most of them.
COPY package.json package-lock.json ./
RUN npm ci

# ----------------------------------------------------------------------- build
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# The Prisma client is generated into src/generated/prisma (see the generator
# block in schema.prisma) and is not in the repository, so it must be generated
# before tsc runs or the build fails on missing types.
RUN npx prisma generate

# tsc-alias rewrites the "@/..." path aliases into relative requires. Without it
# the compiled output imports specifiers Node cannot resolve at runtime.
#
# Kept as a type-check gate even though the runtime stage does NOT execute this
# output — see the note on tsx below. A build that fails here should still fail
# the image.
RUN npm run build

# --------------------------------------------------------------------- runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# openssh-client is a hard runtime requirement, not a convenience: the Ansible
# adapter reaches the control node by exec'ing the `ssh` binary directly
# (src/lib/remoteAnsible.ts). Without it every collection fails with "The ssh
# client was not found on this server".
#
# ca-certificates is needed for the outbound HTTPS calls — Groq, Tavily,
# Pinecone, Bedrock — which otherwise fail certificate verification.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# tsx is included deliberately, and it is the one place this image departs from
# "compile, then ship the JavaScript".
#
# Prisma 7's generated client is ESM-only: it calls import.meta.url to locate
# its own directory. Compiling it with tsc under this project's CommonJS
# settings emits require()/exports *and* leaves import.meta in place, producing
# a file that is valid as neither module format — Node reads the import.meta,
# treats the file as ESM, and every require() inside it then resolves against
# the working directory instead of the module. `node dist/src/server.js` fails
# on the first Prisma import.
#
# That is a pre-existing property of the build, not a containerisation problem:
# the app has only ever been run through tsx (`npm run dev`), which handles the
# mixed module graph, so nothing had executed the compiled output before.
#
# The real fix is to move the backend to ESM ("type": "module"), which requires
# adding explicit .js extensions to every relative and aliased import under
# node16 resolution — a source-wide change with its own risk. Until that is
# done, running the TypeScript directly is the honest option: it is exactly how
# the application runs in development, so the container executes the same code
# path that is actually tested.
#
# --include=dev is required, not incidental: NODE_ENV=production is set above,
# and npm honours it by skipping devDependencies — which would leave tsx absent
# and make npx silently download it from the network on every container start.
RUN npm ci --include=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY tsconfig.json ./
COPY src ./src
# The generated Prisma client is not in the repository, so it comes from the
# build stage where `prisma generate` produced it.
COPY --from=build /app/src/generated ./src/generated
# Shipped so the entrypoint can run `prisma migrate deploy` against a fresh
# database on first start.
COPY --from=build /app/prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    # PDFs are written here; the directory must exist and be writable by the
    # unprivileged user the container runs as.
    && mkdir -p /app/generated-reports \
    && chown -R node:node /app

# Runs unprivileged. The `node` user ships with the base image as uid 1000.
USER node

EXPOSE 4000

ENTRYPOINT ["docker-entrypoint.sh"]
# Not `node dist/src/server.js` — see the tsx note above. Swap back to the
# compiled output once the backend is migrated to ESM.
CMD ["npx", "tsx", "src/server.ts"]
