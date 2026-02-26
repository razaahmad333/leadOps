# Infrastructure (Local)

This folder contains local infrastructure for HikmahOne LeadOps.

## Services
- PostgreSQL 16 (`localhost:5432`)
- Redis 7 (`localhost:6379`)

## Run
```bash
docker compose -f infra/docker-compose.yml up -d
```

## Stop
```bash
docker compose -f infra/docker-compose.yml down
```

## Reset volumes
```bash
docker compose -f infra/docker-compose.yml down -v
```
