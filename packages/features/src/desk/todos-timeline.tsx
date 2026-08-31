'use client';

import type { LocalTimeBlock } from '@kayamo/offline';
import { useState } from 'react';
import styles from '../food/desk.module.css';
import {
  DAY_END_MIN,
  DAY_START_MIN,
  HOUR_PX,
  SNAP_MIN,
  blockHeightPx,
  blockTopPx,
  hourMarks,
  minutesToLabel,
  snapMinutes,
  yToMinutes,
} from '../todo/timetable';

type Draft = { start: number; end: number };

export function TodosTimeline({
  blocks,
  conflicts,
  selectedId,
  onSelect,
  onCommit,
  onCreateAt,
}: {
  blocks: LocalTimeBlock[];
  conflicts: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCommit: (id: string, startMin: number, endMin: number) => void;
  onCreateAt: (startMin: number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  function shown(block: LocalTimeBlock): Draft {
    return drafts[block.id] ?? { start: block.start_min, end: block.end_min };
  }

  function beginDrag(
    event: React.PointerEvent<HTMLElement>,
    block: LocalTimeBlock,
    mode: 'move' | 'resize',
  ) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(block.id);
    const originY = event.clientY;
    const origin: Draft = { start: block.start_min, end: block.end_min };
    let latest = origin;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    function move(ev: PointerEvent) {
      const delta = ((ev.clientY - originY) / HOUR_PX) * 60;
      if (mode === 'move') {
        const duration = origin.end - origin.start;
        const start = snapMinutes(
          Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - duration, origin.start + delta)),
        );
        latest = { start, end: start + duration };
      } else {
        const end = snapMinutes(
          Math.max(origin.start + SNAP_MIN, Math.min(DAY_END_MIN, origin.end + delta)),
        );
        latest = { start: origin.start, end };
      }
      setDrafts((current) => ({ ...current, [block.id]: latest }));
    }

    function up(ev: PointerEvent) {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      if (target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId);
      onCommit(block.id, latest.start, latest.end);
      setDrafts((current) => {
        const copy = { ...current };
        delete copy[block.id];
        return copy;
      });
    }

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  return (
    <div
      className={styles.timeline}
      onDoubleClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const start = yToMinutes(event.clientY - rect.top);
        onCreateAt(Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - 30, start)));
      }}
    >
      {hourMarks().map((mark) => (
        <div key={mark} className={styles.hourLane} style={{ top: blockTopPx(mark), height: HOUR_PX }}>
          <span>{minutesToLabel(mark)}</span>
        </div>
      ))}
      {blocks.map((block) => {
        const pos = shown(block);
        return (
          <div
            key={block.id}
            className={styles.timeBlock}
            data-selected={selectedId === block.id ? 'true' : undefined}
            data-conflict={conflicts.has(block.id) ? 'true' : undefined}
            data-locked={block.locked ? 'true' : undefined}
            data-flex={block.flexibility}
            style={{
              top: blockTopPx(pos.start),
              height: blockHeightPx(pos.start, pos.end),
            }}
          >
            <button
              type="button"
              className={styles.timeBlockHit}
              onClick={() => onSelect(block.id)}
              onPointerDown={(event) => beginDrag(event, block, 'move')}
            >
              <strong>{block.title}</strong>
              <small>
                {minutesToLabel(pos.start)}–{minutesToLabel(pos.end)}
                {block.locked ? ' · locked' : ''}
              </small>
            </button>
            <button
              type="button"
              className={styles.resizeHandle}
              aria-label={`Resize ${block.title}`}
              onPointerDown={(event) => beginDrag(event, block, 'resize')}
            />
          </div>
        );
      })}
    </div>
  );
}
