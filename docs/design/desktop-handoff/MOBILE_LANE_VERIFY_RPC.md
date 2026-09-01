# Mobile lane — `verify_ph_core_food` + `upsertPhCoreFoods` preserve

Copy this into a kayamo-mobile session. The function is the desktop sitting’s
blocker: six frontend tranches are in, and verifications still cannot persist
anywhere real. Palette speed, the Android app seeing verified data, and a
second machine all wait on this.

Do **not** edit kayamo-web. `packages/`, `supabase/`, and `data/` are owned by
kayamo-mobile. After this lands, `./sync-packages.sh` from the KayaMo container
propagates the copy. The desktop client already calls this RPC; keep the name
and argument shape below or the overlay migrate will keep treating it as missing.

## Why SECURITY DEFINER

`foods_update` RLS only allows `source = 'user'` rows the caller created.
Authenticated users cannot UPDATE `source = 'ph_core'`. That is correct for
ordinary clients. Verification of a PH-core row is a deliberate, authenticated
write that must go through one gated function.

## Client contract (already shipping in kayamo-web)

`packages/features/src/food/verify-rpc.ts`:

```ts
await client.rpc('verify_ph_core_food', {
  food_id, // uuid
  nutrients: {
    kcal,        // string or number, per 100 g
    protein_g,
    carbs_g,
    fat_g,
    source_note, // string
  },
  serving: null, // reserved; may be `{ label, grams }` later
});
```

- Missing function (`PGRST202`) → desktop keeps the localStorage overlay.
- Any other error (including your validation raises) → overlay stays. Do not
  “succeed” a bad write; the sitting’s numbers must not vanish on a 400.
- On success the desktop drops that food id from the overlay. Postgres is then
  the source of truth (`verified_by_user`, `confidence = 1.00`, nutrients).

## Pin `search_path`

`SECURITY DEFINER` runs as the owner and bypasses RLS. An attacker-controlled
`search_path` can hijack unqualified names (`foods`, `auth.uid()`, …). This is
the standard Postgres footgun. Get it right on the first DEFINER function that
writes PH-core.

Required:

```sql
create or replace function public.verify_ph_core_food(
  food_id uuid,
  nutrients jsonb,
  serving jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
```

- `SET search_path = ''` — empty, not `public`. `pg_catalog` is still searched
  for operators and types.
- Fully-qualify every table: `public.foods`, `public.servings` if you touch them.
- Fully-qualify `auth.uid()`.
- Do **not** use unqualified `foods` / `servings` anywhere in the body.
- Owner must be a role the caller cannot `ALTER FUNCTION` on (postgres /
  supabase_admin). `REVOKE ALL … FROM PUBLIC, anon`. `GRANT EXECUTE` to
  `authenticated` and `service_role` only.

## Validate inside the function, not the client

The client half is a convenience, not a gate. DEFINER bypasses RLS, so it
cannot trust anything the browser sends.

Reject (raise with a stable SQLSTATE, e.g. `22023` / `P0001`):

1. **`auth.uid() IS NULL`** — no anonymous verifies.
2. **Row missing, tombstoned, or `source != 'ph_core'`** — this function must
   never write USDA / brand / user foods. Those stay on ordinary RLS.
3. **Non-positive or unreadable macros**
   - `kcal` must be `> 0`.
   - `protein_g`, `carbs_g`, `fat_g` must be `>= 0` and finite.
   - Reject if all three macros are 0.
4. **Absurd per-100 g values** (PH core is per 100 g):
   - `kcal > 900`
   - any of protein / carbs / fat `> 100`
5. **`source_note`** present, trimmed, length 1–2000. No empty note — Verify
   requires the sentence that explains the number.
6. **Atwater, recomputed server-side.** Do not accept a client “reconciles”
   flag (the client does not even send one). Inside the function:

   ```
   expected = 4 * protein_g + 4 * carbs_g + 9 * fat_g
   delta    = abs(kcal - expected) / greatest(kcal, expected, 1)
   ```

   Same constants as `@kayamo/food` (`ATWATER_PROTEIN/CARBS/FAT = 4/4/9`,
   `ATWATER_TOLERANCE = 0.05`). **Do not trust the client’s drift %.**

   Do **not** reject a human verify solely because `delta > 0.05`. The sitting
   can confirm a source’s number that still drifts; the gate is “we computed
   this ourselves,” not “the row must already be perfect.” Return
   `atwater_delta` in the JSON result so callers can display it. Never log the
   nutrient payload (health data stays out of logs).

On success, UPDATE `public.foods` SET:

- `kcal`, `protein_g`, `carbs_g`, `fat_g`, `source_note` from the validated
  payload
- `verified_by_user = true`
- `confidence = 1.00`
- `updated_at = now()` (or let the existing touch trigger do it)

Do **not** change `source`, `source_id`, `name`, `name_tl`, `created_by`,
`shared`, `deleted_at`.

`serving` is currently always `null` from desktop. If non-null later: require
`label` text and `grams > 0`, then upsert `public.servings` for that food.
Ignore `serving` until that contract is used; still accept `null`.

Return JSON roughly:

```json
{
  "id": "<food_id>",
  "verified_by_user": true,
  "confidence": 1.00,
  "kcal": 130,
  "protein_g": 2.7,
  "carbs_g": 28.2,
  "fat_g": 0.3,
  "atwater_delta": 0.0
}
```

## `upsertPhCoreFoods` must not clobber verifies

This matters as much as the RPC. `packages/db/src/ph-core.ts` `upsertPhCoreFoods`
currently `onConflictDoUpdate`s `verified_by_user: row.verified` from YAML
along with kcal / macros / confidence / source_note.

The first `pnpm ph-core:build` after a real sitting would silently reset every
`verified_by_user = true` row to the YAML snapshot. The palette would get slow
again and nobody would know why.

Required preserve, **when the existing row already has `verified_by_user = true`:**

- Do not overwrite `kcal`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`,
  `sugar_g`, `sodium_mg`, `source_note`, `confidence`, `verified_by_user`.
- Do not rebuild that food’s servings from YAML (that would swap the portion
  the user verified against).
- Alias inserts may still `onConflictDoNothing` — additive, not a clobber.

Unverified rows keep today’s full YAML upsert.

Implement in kayamo-mobile `packages/db/src/ph-core.ts`. A CASE in
`onConflictDoUpdate` is enough for the nutrient columns; skip the servings loop
when the existing row is already verified (SELECT `verified_by_user` first, or
`returning` the previous flag).

Add a test that: insert a ph_core row with `verified_by_user = true` and
distinct macros, run `upsertPhCoreFoods` with different YAML macros, assert the
verified nutrients and flag are unchanged.

## Suggested SQL skeleton

Keep the PostgREST names (`food_id`, `nutrients`, `serving`) so the desktop
client does not change. Inside the body, alias them immediately to avoid
clashing with `public.foods` columns.

```sql
create or replace function public.verify_ph_core_food(
  food_id uuid,
  nutrients jsonb,
  serving jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p_id uuid := food_id;
  p_nutrients jsonb := nutrients;
  v_kcal numeric;
  v_protein numeric;
  v_carbs numeric;
  v_fat numeric;
  v_note text;
  v_expected numeric;
  v_delta numeric;
  updated public.foods%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_kcal := nullif(btrim(coalesce(p_nutrients->>'kcal', '')), '')::numeric;
  v_protein := nullif(btrim(coalesce(p_nutrients->>'protein_g', '')), '')::numeric;
  v_carbs := nullif(btrim(coalesce(p_nutrients->>'carbs_g', '')), '')::numeric;
  v_fat := nullif(btrim(coalesce(p_nutrients->>'fat_g', '')), '')::numeric;
  v_note := btrim(coalesce(p_nutrients->>'source_note', ''));

  if v_kcal is null or v_protein is null or v_carbs is null or v_fat is null then
    raise exception 'nutrients required' using errcode = '22023';
  end if;
  if v_kcal <= 0 or v_protein < 0 or v_carbs < 0 or v_fat < 0 then
    raise exception 'non-positive macros' using errcode = '22023';
  end if;
  if v_protein = 0 and v_carbs = 0 and v_fat = 0 then
    raise exception 'macros all zero' using errcode = '22023';
  end if;
  if v_kcal > 900 or v_protein > 100 or v_carbs > 100 or v_fat > 100 then
    raise exception 'absurd per-100g values' using errcode = '22023';
  end if;
  if char_length(v_note) < 1 or char_length(v_note) > 2000 then
    raise exception 'source_note required' using errcode = '22023';
  end if;

  v_expected := 4 * v_protein + 4 * v_carbs + 9 * v_fat;
  v_delta := abs(v_kcal - v_expected) / greatest(v_kcal, v_expected, 1);

  update public.foods as f
  set
    kcal = v_kcal,
    protein_g = v_protein,
    carbs_g = v_carbs,
    fat_g = v_fat,
    source_note = v_note,
    verified_by_user = true,
    confidence = 1.00
  where f.id = p_id
    and f.source = 'ph_core'
    and f.deleted_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'not a live ph_core food' using errcode = '22023';
  end if;

  -- `serving` is ignored while the desktop sends null.

  return jsonb_build_object(
    'id', updated.id,
    'verified_by_user', updated.verified_by_user,
    'confidence', updated.confidence,
    'kcal', updated.kcal,
    'protein_g', updated.protein_g,
    'carbs_g', updated.carbs_g,
    'fat_g', updated.fat_g,
    'atwater_delta', v_delta
  );
end;
$$;

revoke all on function public.verify_ph_core_food(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.verify_ph_core_food(uuid, jsonb, jsonb) to authenticated, service_role;
```

Next migration number is whatever follows the current head in kayamo-mobile
(web’s copy tops out at `0019_sync_sequence.sql` — do not add the file here).

## Out of scope

- Desktop overlay, `/` jump, Atwater inspector — already in kayamo-web T5/T6.
- Changing the RPC name or argument keys.
- Letting the LLM write nutrients.
- Logging request bodies.
