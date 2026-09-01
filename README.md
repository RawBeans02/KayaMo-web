# kayamo-web

Standalone KayaMo desktop app. Like KitaMo, the Next.js app lives at the
repository root. It provides sidebar navigation, Command-K logging, and desktop
review workflows. It contains no Capacitor shell and no browser-visible
service-role credentials.

```bash
pnpm install
pnpm dev       # http://localhost:3002
pnpm build
pnpm test
```

Deploy this repository from its root. Set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL=https://www.kayamo.fit`
in the Vercel environment. Apex `https://kayamo.fit` already 308s to `www`
and keeps `/auth/callback` query params.

In the Supabase project, set Authentication → URL Configuration:

- Site URL: `https://www.kayamo.fit`
- Redirect URLs:
  - `https://www.kayamo.fit/auth/callback**`
  - `https://www.kayamo.fit/**`
  - `https://kayamo.fit/auth/callback**`
  - `https://kayamo.fit/**`

If Site URL stays `http://localhost:3000`, magic links open there with `?code=`
instead of completing sign-in on kayamo.fit.

Hosted smoke (no local server):

```bash
pnpm test:e2e:hosted
```

`packages/`, `supabase/`, and `data/` are synchronized copies owned by the
sibling `kayamo-mobile` repository. Run `../sync-packages.sh` from the parent
KayaMo folder after changing shared code there.
