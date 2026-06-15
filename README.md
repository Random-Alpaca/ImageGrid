# Jacky Xue — Photo Portfolio

A Vite + React + Tailwind portfolio with an infinite drifting image grid. Links
back to [jxue.ca](https://jxue.ca). Photos are managed through a passphrase-gated
admin page backed by a small Vercel serverless API + Upstash Redis.

## Add / manage photos

### The hidden `/admin` page (primary)

Visit `/admin` on the site (it's unlinked — just type the URL) and enter your
passphrase. Add photos with a URL, title, and caption; reorder or delete them;
then click **Save to site**. Changes go to the backend and are live for everyone.

- **External hosting (recommended):** upload your image anywhere (your own CDN,
  S3, Cloudinary, imgur, etc.) and paste its direct image URL.
- **Local file:** drop the image into `public/photos/` and use `/photos/file.jpg`.

The grid repeats your photos to fill the screen, so even a few look full.

### Static fallback — `src/photos.ts`

If the backend is ever unavailable, the gallery falls back to the list in
[`src/photos.ts`](src/photos.ts). You can regenerate that file from the current
photos with the **Copy photos.ts** button on `/admin`.

## Backend setup (one time, in Vercel)

The app reads photos publicly from `/api/photos` and writes them only when a
request carries the correct passphrase. To enable it:

1. **Add Upstash Redis:** in the Vercel dashboard → your project → **Storage** →
   add **Upstash Redis** (Marketplace). This injects the connection env vars
   automatically (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or the `UPSTASH_*`
   equivalents — the API accepts either).
2. **Set the passphrase:** Project → **Settings → Environment Variables** → add
   `ADMIN_PASSWORD` = your chosen passphrase. ⚠️ Do **not** prefix it with
   `VITE_` — that would bundle it into the client. It must stay server-only.
3. **Redeploy.**

How auth works: the passphrase is sent over HTTPS in an `Authorization: Bearer`
header and compared on the server (constant-time) against `ADMIN_PASSWORD`. It is
never stored in the browser or shipped in the JS bundle. `GET /api/photos` is
public (the gallery needs it); `PUT /api/photos` and `POST /api/verify` require
the passphrase.

> Note: this is a single shared passphrase — appropriate for a personal site, but
> not full multi-user auth. Rotate it by changing `ADMIN_PASSWORD` and redeploying.

## Develop

```bash
pnpm install
pnpm dev          # frontend only — /api functions don't run here; the gallery
                  # falls back to src/photos.ts and /admin can't unlock
vercel dev        # full local stack incl. /api (needs Vercel CLI + the env vars
                  # above in a local .env / `vercel env pull`)
pnpm build        # production build -> dist/
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the repo (Vercel auto-detects Vite and
   builds the `api/` functions).
3. Complete **Backend setup** above, then redeploy.

### Note on the install step

The native build scripts (`esbuild`, `@tailwindcss/oxide`) must be approved or
pnpm exits non-zero on install and fails the Vercel build. They're approved in
`pnpm-workspace.yaml` (`onlyBuiltDependencies`). pnpm **11.7.0 has a bug** where
that approval is read but not applied, so the package manager is pinned to
**`pnpm@10.18.0`** (`package.json#packageManager`), which honors it correctly.
Nothing else to configure.
