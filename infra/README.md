# Infrastructure

Docker Compose configuration for local development.

## Services

| Service    | Port | Credentials                                            |
|------------|------|--------------------------------------------------------|
| PostgreSQL 16 | 5432 | user: `leadops` / pass: `leadops_secret` / db: `leadops_dev` |
| Redis 7    | 6379 | no auth required                                       |

## Usage

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# Stop all services
docker compose down

# Destroy all data (volumes) — use with caution!
docker compose down -v

# View logs
docker compose logs -f postgres
docker compose logs -f redis
```

## Connection Strings

- **PostgreSQL**: `postgresql://leadops:leadops_secret@localhost:5432/leadops_dev`
- **Redis**: `redis://localhost:6379`

## pgAdmin (optional)

Uncomment the `pgadmin` service in `docker-compose.yml` to enable a browser-based
PostgreSQL GUI at `http://localhost:5050`.

- Email: `admin@leadops.local`
- Password: `admin`
