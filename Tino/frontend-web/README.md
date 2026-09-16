# ---- Tino Frontend Web ----

Web client for the **Tino** product. Built with **Next.js 14 (App Router)**
and **TypeScript**.

> NOTE: This README will be filled in after the product description in
> `../docs/` is finalized. The skeleton below only documents the **bootstrap**
> so the project can be installed and built right away.


## Requirements

- Node.js >= 18.18 (LTS recommended)
- npm / pnpm / yarn (examples use `npm`)

## Install & run (local)

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```


## Layout (planned)

```
frontend-web/
├── src/
│   ├── app/          # App Router routes
│   ├── components/   # Shared UI primitives
│   └── ...           # (filled in later)
├── public/
├── package.json
├── tsconfig.json
├── next.config.mjs
└── README.md         # ← to be expanded once docs/ is ready
```


## Talking to the backend

The frontend is expected to talk to the FastAPI backend in `../backend/`
(`/api/v1/...`). A typed API client and environment configuration will be
documented here once the surface is defined in `../docs/`.

