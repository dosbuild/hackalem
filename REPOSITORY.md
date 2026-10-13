# Active source map

- Entry: `index.html` → `src/main.tsx` → `src/app/App.tsx`.
- Plan and numerical model: `src/app/state.ts`, `src/domain/`.
- Geography: `data/prepared/`, `scripts/alem/`, `public/alem/`.
- World boundary: `src/world/contract.ts`.
- Shared development/production APIs: `server/api.ts`; HTTP release: `server/http.ts`.
- Runtime allowlist: `scripts/release/build.mjs`.
- Browser development: `.devcontainer/devcontainer.json`, `npm run dev`.
- Operations: `README.md`, `DEPLOY_RAILWAY.md`, `docs/release.md`.

The standalone production source uses a fresh root commit. Retired studies and old
Git objects are excluded from this source package. Browser checks write to
ignored `artifacts/`. Only files in the
generated production allowlist are served to visitors.
