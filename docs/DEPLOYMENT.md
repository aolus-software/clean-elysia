# Deployment

Four ways to run this app in production. **Pick exactly one scaling
strategy** — cluster mode and reuse-port both bind the same port and will
fight each other if enabled together.

| Option            | Multi-core | How it scales                         | Best for                       |
| ----------------- | ---------- | ------------------------------------- | ------------------------------ |
| 1. Node cluster   | ✅         | In-process worker forks               | Single VM/container, simplest  |
| 2. Bun reuse-port | ✅         | N independent processes, SO_REUSEPORT | Bare metal / systemd           |
| 3. PM2            | ✅         | PM2 forks N reuse-port processes      | VMs needing supervision/reload |
| 4. Docker         | ✅         | cluster in-container, or `--scale`    | Containerized infra            |

The entry point is `src/index.ts`. It reads two env flags and decides at boot:

- `APP_CLUSTER_MODE` — when `true`, the primary forks `APP_CLUSTER_WORKERS`
  workers (0 = all CPU cores) using Node's `cluster` module.
- `APP_REUSE_PORT` — when `true`, each process binds the port with
  `reusePort: true` (`src/server.ts`); the kernel load-balances. You launch N
  processes yourself (PM2, systemd, `--scale`).

---

## 1. Node cluster (built in)

No new processes to manage — one command, the primary forks workers and
restarts any that die.

```sh
APP_CLUSTER_MODE=true APP_CLUSTER_WORKERS=0 bun run src/index.ts
# WORKERS=0 -> one worker per CPU core
```

Trade-off: a single OS process tree. If the primary dies, all workers go with
it — pair with a supervisor (systemd / Docker `restart`) for resilience.

## 2. Bun reuse-port

Each process is fully independent; the kernel spreads connections via
SO_REUSEPORT. No primary, no shared socket fd.

```sh
# Launch as many as you want — all on APP_PORT
APP_REUSE_PORT=true bun run src/index.ts &
APP_REUSE_PORT=true bun run src/index.ts &
APP_REUSE_PORT=true bun run src/index.ts &
```

Leave `APP_CLUSTER_MODE=false`. In practice you let a supervisor (PM2 below,
or systemd templated units) own the N processes rather than `&`.

## 3. PM2 — `ecosystem.config.cjs`

PM2 supervises N fork-mode Bun processes, each with `APP_REUSE_PORT=true`.
We avoid PM2's `cluster` exec_mode (it depends on Node cluster, flaky under
Bun) and use reuse-port instead.

```sh
bun add -g pm2          # or npm i -g pm2
pm2 start ecosystem.config.cjs --env production
pm2 reload clean-elysia          # zero-downtime rolling restart
pm2 logs clean-elysia
pm2 save && pm2 startup          # persist across reboots
```

Worker count: defaults to `max` (all cores). Override with
`PM2_INSTANCES=4 pm2 start ecosystem.config.cjs --env production`.

## 4. Docker

The `Dockerfile` is multi-stage (run-from-source — no bundle step, so the
runtime cluster/reuse-port logic is preserved):

- `development` — hot reload (`bun run dev`)
- `migrator` — runs `db:migrate` (has dev deps incl. drizzle-kit)
- `release` — prod deps + `src`, runs `bun run src/index.ts` as user `bun`

```sh
# Build + run the production image directly
docker build --target release -t clean-elysia .
docker run --rm -p 3000:3000 --env-file .env \
  -e APP_CLUSTER_MODE=true clean-elysia
```

### Compose

`docker-compose.yml` brings up postgres + redis + clickhouse + the app
(built from the `release` target). The `app` service defaults to
`APP_CLUSTER_MODE=true` (one container scales across cores).

```sh
docker compose up -d --build

# run migrations once (separate image with dev deps)
docker build --target migrator -t clean-elysia:migrator .
docker run --rm --network <project>_app_network --env-file .env clean-elysia:migrator
```

Alternative — scale by replicas instead of in-container cluster: set
`APP_CLUSTER_MODE=false` + `APP_REUSE_PORT=true` on the `app` service, then
`docker compose up -d --scale app=4` (remove the host `ports` mapping and put
a reverse proxy in front, since N containers can't all publish `3000:3000`).

---

## Migrations

`db:migrate` needs `drizzle-kit` (a devDependency), so it does **not** run in
the lean `release` image. Run it from the `migrator` Docker stage, from a dev
checkout, or in a CI/CD step before rolling the app.

## Choosing

- One box, want simplest → **node cluster** (option 1) under systemd/Docker.
- Need zero-downtime reloads + process metrics on a VM → **PM2** (option 3).
- Containerized → **Docker** (option 4): cluster inside one container, or
  reuse-port + `--scale` behind a proxy for horizontal replicas.
