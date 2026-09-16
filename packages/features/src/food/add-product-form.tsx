'use client';

import { cacheFoodWithServings } from '@kayamo/offline';
import {
  confirmConfidence,
  NUTRIENT_KEYS,
  nutrientsFromLabel,
  type NutrientKey,
  type UserFoodDraft,
} from '@kayamo/food/label-ocr';
import { Button } from '@kayamo/ui';
import { apiFetch } from '../api/api-origin';
import { useMemo, useState } from 'react';

const LABELS: Record<NutrientKey, string> = {
  kcal: 'kcal',
  protein_g: 'protein g',
  carbs_g: 'carbs g',
  fat_g: 'fat g',
  fiber_g: 'fiber g',
  sugar_g: 'sugar g',
  sodium_mg: 'sodium mg',
};

function emptyNutrients(): Record<NutrientKey, string> {
  return {
    kcal: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    fiber_g: '',
    sugar_g: '',
    sodium_mg: '',
  };
}

function parseNum(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function AddProductForm({
  barcode: initialBarcode,
  onSaved,
}: {
  barcode: string;
  onSaved: () => void;
}) {
  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingLabel, setServingLabel] = useState('1 pack');
  const [servingGrams, setServingGrams] = useState('');
  const [basis, setBasis] = useState<'per_serving' | 'per_100g'>('per_serving');
  const [labeled, setLabeled] = useState(emptyNutrients());
  const [per100g, setPer100g] = useState(emptyNutrients());
  const [shared, setShared] = useState(false);
  const [contributeToOff, setContributeToOff] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [lowConfidence, setLowConfidence] = useState<string[]>([]);
  const [ocrOverall, setOcrOverall] = useState(0.7);
  const [busy, setBusy] = useState<'ocr' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const flagged = useMemo(() => new Set([...missing, ...lowConfidence]), [missing, lowConfidence]);

  function applyDraft(draft: UserFoodDraft) {
    setName(draft.name ?? '');
    setBrand(draft.brand ?? '');
    if (draft.barcode) setBarcode(draft.barcode);
    setServingLabel(draft.servingLabel);
    setServingGrams(draft.servingGrams !== undefined ? String(draft.servingGrams) : '');
    setBasis(draft.basis);
    const nextLabeled = emptyNutrients();
    const nextPer100 = emptyNutrients();
    for (const key of NUTRIENT_KEYS) {
      const labeledValue = draft.labeled[key];
      const perValue = draft.per100g[key];
      if (labeledValue !== undefined) nextLabeled[key] = String(labeledValue);
      if (perValue !== undefined) nextPer100[key] = String(Math.round(perValue * 100) / 100);
    }
    setLabeled(nextLabeled);
    setPer100g(nextPer100);
    setMissing(draft.missing);
    setLowConfidence(draft.lowConfidence);
    setOcrOverall(draft.overallConfidence);
  }

  function recomputePer100g(nextGrams: string, nextLabeled: Record<NutrientKey, string>) {
    const grams = parseNum(nextGrams);
    const labeledPartial = Object.fromEntries(
      NUTRIENT_KEYS.flatMap((key) => {
        const value = parseNum(nextLabeled[key]);
        return value === undefined ? [] : [[key, value] as const];
      }),
    );
    if (Object.keys(labeledPartial).length === 0) return;
    const converted = nutrientsFromLabel({
      basis,
      ...(grams !== undefined ? { servingGrams: grams } : {}),
      labeled: labeledPartial,
    });
    const next = emptyNutrients();
    for (const key of NUTRIENT_KEYS) {
      const value = converted[key];
      next[key] = value !== undefined ? String(Math.round(value * 100) / 100) : '';
    }
    setPer100g(next);
  }

  async function onOcr(file: File) {
    setBusy('ocr');
    setError(null);
    setPhotoName(file.name);
    const data = new FormData();
    data.set('image', file);
    if (barcode) data.set('barcode', barcode);
    try {
      const res = await apiFetch('/api/foods/ocr', { method: 'POST', body: data });
      const json = (await res.json()) as { draft?: UserFoodDraft; error?: string };
      if (!res.ok || !json.draft) {
        setError(json.error ?? 'Could not read that label. Fill the fields by hand.');
        return;
      }
      applyDraft(json.draft);
    } catch {
      setError('Could not read that label. Fill the fields by hand.');
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    const grams = parseNum(servingGrams);
    const nutrients = Object.fromEntries(
      NUTRIENT_KEYS.map((key) => [key, parseNum(per100g[key])]),
    ) as Record<NutrientKey, number | undefined>;
    const stillMissing: string[] = [];
    if (!name.trim()) stillMissing.push('name');
    if (grams === undefined) stillMissing.push('servingGrams');
    for (const key of NUTRIENT_KEYS) {
      if (nutrients[key] === undefined) stillMissing.push(key);
    }
    setMissing(stillMissing);
    if (stillMissing.length > 0) {
      setError('Fill the highlighted fields. Empty means unread. Type 0 only if the label says 0.');
      return;
    }

    setBusy('save');
    setError(null);
    try {
      const res = await apiFetch('/api/foods/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          ...(barcode ? { barcode } : {}),
          servingLabel: servingLabel.trim() || `${grams} g`,
          servingGrams: grams,
          per100g: nutrients,
          shared,
          contributeToOff,
          confidence: confirmConfidence(ocrOverall),
        }),
      });
      const json = (await res.json()) as {
        food?: Parameters<typeof cacheFoodWithServings>[0];
        servings?: Parameters<typeof cacheFoodWithServings>[1];
        error?: string;
      };
      if (!res.ok || !json.food || !json.servings) {
        setError(json.error ?? 'Could not save that food.');
        return;
      }
      await cacheFoodWithServings(json.food, json.servings);
      onSaved();
    } catch {
      setError('Could not save that food. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const inputClass = (id: string) =>
    `min-h-12 w-full border-b bg-transparent px-0 font-body text-body text-text outline-none placeholder:text-muted ${
      flagged.has(id) ? 'border-warning' : 'border-line'
    }`;

  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
          nutrition facts photo
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy !== null}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onOcr(file);
          }}
          className="font-body text-body text-text file:mr-3 file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-body file:text-body"
        />
        {photoName ? (
          <span className="font-data text-caption text-muted">{photoName}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">barcode</span>
        <input
          inputMode="numeric"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value.replace(/\D/g, '').slice(0, 14))}
          className={inputClass('barcode')}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass('name')} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">brand</span>
        <input value={brand} onChange={(event) => setBrand(event.target.value)} className={inputClass('brand')} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
          serving label
        </span>
        <input
          value={servingLabel}
          onChange={(event) => setServingLabel(event.target.value)}
          className={inputClass('servingLabel')}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
          serving grams
        </span>
        <input
          inputMode="decimal"
          value={servingGrams}
          onChange={(event) => {
            const value = event.target.value;
            setServingGrams(value);
            recomputePer100g(value, labeled);
          }}
          className={inputClass('servingGrams')}
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="font-data text-caption uppercase tracking-[0.14em] text-muted">
          per 100 g
        </legend>
        {NUTRIENT_KEYS.map((key) => (
          <label key={key} className="flex flex-col gap-2">
            <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
              {LABELS[key]}
            </span>
            <input
              inputMode="decimal"
              value={per100g[key]}
              onChange={(event) => setPer100g((current) => ({ ...current, [key]: event.target.value }))}
              className={inputClass(key)}
            />
          </label>
        ))}
      </fieldset>

      <label className="flex items-start gap-3 font-body text-body">
        <input
          type="checkbox"
          checked={shared}
          onChange={(event) => setShared(event.target.checked)}
          className="mt-1 size-4 accent-accent"
        />
        <span>Share with other KayaMo users</span>
      </label>

      <label className="flex items-start gap-3 font-body text-body">
        <input
          type="checkbox"
          checked={contributeToOff}
          onChange={(event) => setContributeToOff(event.target.checked)}
          className="mt-1 size-4 accent-accent"
        />
        <span>Contribute this pack to Open Food Facts</span>
      </label>

      {lowConfidence.length > 0 ? (
        <p className="font-body text-body text-warning">
          Check the highlighted fields. The photo was hard to read there.
        </p>
      ) : null}
      {error ? <p className="font-body text-body text-warning">{error}</p> : null}

      <Button type="submit" size="lg" disabled={busy !== null}>
        {busy === 'ocr' ? 'Reading label…' : busy === 'save' ? 'Saving…' : 'Confirm and save to My Foods'}
      </Button>
    </form>
  );
}
