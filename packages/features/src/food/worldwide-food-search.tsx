'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { normalizedFoodSchema, nutrientsFromPer100g, type NormalizedFood } from '@kayamo/food/search-ui';
import { mealSlotAtHour, mealSlotLabel, MEAL_SLOTS, type MealSlot } from '@kayamo/food/quick-log';
import { localHourFromInstant, logFoodEntry, tombstoneLocalFoodEntries } from '@kayamo/offline';
import { Button } from '@kayamo/ui';
import { useDeskClock } from '../desk/use-desk-clock';
import styles from './worldwide-food-search.module.css';

export function WorldwideFoodSearch({ userId, guest = false }: { userId: string; guest?: boolean }) {
  const { clock } = useDeskClock(userId);
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<NormalizedFood[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<NormalizedFood | null>(null);
  const [grams, setGrams] = useState('100');
  const [slot, setSlot] = useState<MealSlot>('tanghalian');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const [saving, setSaving] = useState(false);
  const review = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) review.current?.focus(); }, [selected]);
  useEffect(() => () => abort.current?.abort(), []);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (guest || !query.trim() || busy) return;
    const ac = new AbortController();
    abort.current?.abort(); abort.current = ac;
    setBusy(true); setError(null); setFoods([]); setSelected(null); setSearched(false);
    try {
      const response = await fetch('/api/foods/worldwide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }), signal: ac.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Search is unavailable.');
      if (!Array.isArray(body.foods)) throw new Error('The search response could not be read.');
      setFoods(body.foods.flatMap((food: unknown) => {
        const parsed = normalizedFoodSchema.safeParse(food);
        return parsed.success ? [parsed.data] : [];
      }));
      setSearched(true);
    } catch (err) {
      if (!ac.signal.aborted) setError(err instanceof Error ? err.message : 'Search is unavailable.');
    } finally { if (!ac.signal.aborted) setBusy(false); }
  }

  async function log() {
    if (!selected || writing.current || !Number.isFinite(Number(grams)) || Number(grams) <= 0) return;
    writing.current = true; setSaving(true); setError(null);
    try {
      const food = selected;
      const row = await logFoodEntry({
        userId, foodId: null, foodName: food.brand ? food.name + ' · ' + food.brand : food.name,
        quantity: '1', grams, ...nutrientsFromPer100g(food.per100g, Number(grams)),
        mealSlot: slot, servingLabel: grams + ' g', source: food.source,
        resolvedVia: food.source, confidence: String(food.confidence),
        inputMethod: 'search', timeZone: clock.timeZone, dayStartsAt: clock.dayStartsAt,
      });
      setSaved({ id: row.id, name: food.name }); setSelected(null);
    } catch { setError('Could not finish saving. Check your diary before retrying.'); }
    finally { writing.current = false; setSaving(false); }
  }

  async function undo() {
    if (!saved || writing.current) return;
    writing.current = true; setSaving(true); setError(null);
    try {
      await tombstoneLocalFoodEntries({ ids: [saved.id], userId }); setSaved(null);
    } catch { setError('Could not undo. Your entry is still available in the diary.'); }
    finally { writing.current = false; setSaving(false); }
  }

  return <section className={styles.section} aria-labelledby="worldwide-title">
    <h2 id="worldwide-title">Find foods from around the world</h2>
    <p>Search ingredients, dishes, packaged foods, or a barcode. Coverage varies; no catalog contains every food.</p>
    {guest ? <p>Demo searches use the saved sample catalog below. <a href="/login?from=demo">Sign in for worldwide search</a>. Demo entries never transfer automatically.</p> :
      <>
        <form className={styles.form} onSubmit={(event) => void search(event)}>
          <label>Food, brand, or barcode
            <input value={query} maxLength={200} disabled={busy || saving} onChange={(e) => {
              setQuery(e.target.value); setFoods([]); setSearched(false); setSelected(null); setError(null);
            }} placeholder="Lentils, yogurt, sushi, or a barcode" />
          </label>
          <Button type="submit" disabled={busy || saving || !query.trim()}>{busy ? 'Searching…' : 'Search worldwide'}</Button>
        </form>
        <p className={styles.note}>Only submitted search text is sent to USDA FoodData Central and Open Food Facts, not your diary or account details. Results may be incomplete when a provider is unavailable.</p>
        {busy && <p role="status">Checking food sources…</p>}
        {searched && foods.length === 0 && <p role="status">No usable match. Try another name or barcode, or create a custom food below from a nutrition label or recipe.</p>}
        <ul className={styles.results}>{foods.map((food) => <li key={food.source + ':' + food.sourceId}>
          <button disabled={saving} onClick={() => {
            setSelected(food); setError(null);
            setGrams(String(food.servings.find((s) => s.isDefault)?.grams ?? 100));
            setSlot(mealSlotAtHour(localHourFromInstant(new Date().toISOString(), clock.timeZone)));
          }}>
            <strong>{food.name}{food.brand ? ' · ' + food.brand : ''}</strong>
            <span>{food.per100g.kcal} kcal / 100 g · {food.source === 'off' ? 'Open Food Facts' : 'USDA'} · Review portion</span>
          </button>
        </li>)}</ul>
        {selected && <div ref={review} tabIndex={-1} role="region" className={styles.review} aria-label="Review food portion">
          <h3>{selected.name}</h3>
          <p>{selected.attribution ?? selected.sourceNote ?? 'USDA FoodData Central'} · Source record: {selected.sourceId}</p>
          <p>Check the product and preparation. Missing micronutrients may appear as zero in source data; this is not a verified complete nutrient profile.</p>
          <div className={styles.form}>
            <label>Amount in grams<input type="number" min="0.1" step="any" value={grams} disabled={saving} onChange={(e) => setGrams(e.target.value)} /></label>
            <label>Meal<select value={slot} disabled={saving} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              {MEAL_SLOTS.map((meal) => <option key={meal} value={meal}>{mealSlotLabel(meal, 'en')}</option>)}
            </select></label>
          </div>
          <p>{Number.isFinite(Number(grams)) && Number(grams) > 0 ? Math.round(selected.per100g.kcal * Number(grams) / 100) : '—'} kcal for this amount</p>
          <div className={styles.actions}>
            <Button disabled={saving || !Number.isFinite(Number(grams)) || Number(grams) <= 0} onClick={() => void log()}>{saving ? 'Saving…' : 'Log this food'}</Button>
            <Button variant="secondary" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button>
          </div>
        </div>}
      </>}
    {error && <p role="alert">{error}</p>}
    {saved && <div className={styles.actions} role="status"><span>Logged {saved.name}. <a href="/calories">Open diary</a></span><Button variant="secondary" disabled={saving} onClick={() => void undo()}>Undo</Button></div>}
  </section>;
}
