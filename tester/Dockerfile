FROM oven/bun:1
ARG OMP_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN bun add -g @oh-my-pi/pi-coding-agent@${OMP_VERSION}
ENV PATH="/root/.bun/bin:${PATH}"
COPY probe.ts /probe.ts
