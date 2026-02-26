# Foundation Research (Step 1)

```md
# Candidate Sources
- https://turbo.build/repo/docs/getting-started/from-example
- https://github.com/vercel/turborepo/tree/main/examples/with-nestjs
- https://nx.dev/technologies/node/nest/introduction
- https://nx.dev/getting-started/tutorials/react-monorepo-tutorial
- https://github.com/mduhan/monorepo-template
- https://github.com/phmz/nx-nest-react-monorepo-template
```

## Candidate Comparison

| Candidate | Stack Match | Maintenance Signal | Bloat Risk | Notes |
|---|---|---|---|---|
| Turborepo official core examples (`with-nestjs` + Vite app patterns) | High (monorepo, Nest; React Vite can be added cleanly) | High (official Vercel docs state examples are core-maintained) | Low | Best base for clean pnpm + turbo workflow with minimal assumptions |
| Nx official generators/docs (Nest + React) | High | High (official Nx docs/plugins) | Medium | Strong generator productivity, but heavier workspace conventions than needed |
| `mduhan/monorepo-template` | High/near-exact (Nest Fastify + React Vite + Tailwind + Turbo + Prisma) | Medium (community template) | Medium | Good inspiration for foldering and DX, but less canonical than official examples |
| `phmz/nx-nest-react-monorepo-template` | Medium-high | Medium | Medium | Useful Nx reference, but less aligned with Turbo preference |

## Decision

Chosen base: **Turborepo official example approach** (`vercel/turborepo` with Nest example conventions), then layering in:
- NestJS Fastify adapter patterns from official Nest docs
- React + Vite + Tailwind + shadcn/ui structure
- Prisma + Postgres + BullMQ + Redis production scaffolding

### Why this base
- It satisfies the **pnpm workspaces + Turborepo preferred** direction.
- Official ownership reduces template staleness risk.
- Lowest starting bloat while still allowing enterprise architecture additions required by HikmahOne LeadOps.
