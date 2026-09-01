'use client';

import type { LocalTimeBlock } from '@kayamo/offline';
import { useRef, useState } from 'react';
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
  shiftTimeRange,
  yToMinutes,
} from '../todo/timetable';

type Draft = { start: number; end: number };

export type TimelineGhost = {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
};

type TimelineItem = {
  id: string;
  title: string;
  start_min: number;
  end_min: number;
  locked?: boolean;
  flexibility?: LocalTimeBlock['flexibility'];
  ghost?: boolean;
};

export function TodosTimeline({
  blocks,
  ghosts = [],
  conflicts,
  selectedId,
  readOnly = false,
  onSelect,
  onCommit,
  onCreateAt,
  onDelete,
  onGhostCommit,
}: {
  blocks: LocalTimeBlock[];
  ghosts?: TimelineGhost[];
  conflicts: Set<string>;
  selectedId: string | null;
  readOnly?: boolean;
  onSelect: (id: string | null) => void;
  onCommit: (id: string, startMin: number, endMin: number) => void;
  onCreateAt: (startMin: number) => void;
  onDelete?: (id: string) => void;
  onGhostCommit?: (id: string, startMin: number, endMin: number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  const items: TimelineItem[] = [
    ...blocks.map((block) => ({
      id: block.id,
      title: block.title,
      start_min: block.start_min,
      end_min: block.end_min,
      locked: block.locked,
      flexibility: block.flexibility,
    })),
    ...ghosts.map((ghost) => ({
      id: ghost.id,
      title: ghost.title,
      start_min: ghost.startMin,
      end_min: ghost.endMin,
      ghost: true,
    })),
  ];

  function shown(item: TimelineItem): Draft {
    return drafts[item.id] ?? { start: item.start_min, end: item.end_min };
  }

  function beginDrag(
    event: React.PointerEvent<HTMLElement>,
    item: TimelineItem,
    mode: 'move' | 'resize',
  ) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(item.id);
    const originY = event.clientY;
    const origin: Draft = { start: item.start_min, end: item.end_min };
    let latest = origin;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    function move(ev: PointerEvent) {
      const delta = ((ev.clientY - originY) / HOUR_PX) * 60;
      const shifted = shiftTimeRange(origin.start, origin.end, delta, mode);
      latest = { start: shifted.startMin, end: shifted.endMin };
      setDrafts((current) => ({ ...current, [item.id]: latest }));
    }

    function up(ev: PointerEvent) {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      if (target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId);
      if (item.ghost) onGhostCommit?.(item.id, latest.start, latest.end);
      else onCommit(item.id, latest.start, latest.end);
      setDrafts((current) => {
        const copy = { ...current };
        delete copy[item.id];
        return copy;
      });
    }

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (!selectedId) return;
    const item = items.find((row) => row.id === selectedId);
    if (!item) return;
    const pos = shown(item);

    if (event.key === 'Escape') {
      event.preventDefault();
      onSelect(null);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDelete?.(item.id);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onSelect(item.id);
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const delta = event.key === 'ArrowUp' ? -SNAP_MIN : SNAP_MIN;
    const next = shiftTimeRange(pos.start, pos.end, delta, event.shiftKey ? 'resize' : 'move');
    setDrafts((current) => ({ ...current, [item.id]: { start: next.startMin, end: next.endMin } }));
    if (item.ghost) onGhostCommit?.(item.id, next.startMin, next.endMin);
    else onCommit(item.id, next.startMin, next.endMin);
  }

  return (
    <div
      ref={rootRef}
      className={styles.timeline}
      tabIndex={0}
      role="list"
      aria-label={readOnly ? 'Day timeline' : 'Day timeline. Arrow keys move a selected block 15 minutes. Shift+arrow resizes. Delete removes it.'}
      onKeyDown={readOnly ? undefined : onKeyDown}
      onDoubleClick={
        readOnly
          ? undefined
          : (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const start = yToMinutes(event.clientY - rect.top);
              onCreateAt(Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - 30, start)));
            }
      }
    >
      {hourMarks().map((mark) => (
        <div key={mark} className={styles.hourLane} style={{ top: blockTopPx(mark), height: HOUR_PX }}>
          <span>{minutesToLabel(mark)}</span>
        </div>
      ))}
      {items.map((item) => {
        const pos = shown(item);
        return (
          <div
            key={item.id}
            className={styles.timeBlock}
            data-selected={selectedId === item.id ? 'true' : undefined}
            data-conflict={conflicts.has(item.id) ? 'true' : undefined}
            data-locked={item.locked ? 'true' : undefined}
            data-flex={item.flexibility}
            data-ghost={item.ghost ? 'true' : undefined}
            style={{
              top: blockTopPx(pos.start),
              height: blockHeightPx(pos.start, pos.end),
            }}
          >
            <button
              type="button"
              className={styles.timeBlockHit}
              onClick={() => onSelect(item.id)}
              onPointerDown={readOnly ? undefined : (event) => beginDrag(event, item, 'move')}
            >
              <strong>
                {item.ghost ? 'Proposed · ' : ''}
                {item.title}
              </strong>
              <small>
                {minutesToLabel(pos.start)}–{minutesToLabel(pos.end)}
                {item.locked ? ' · locked' : ''}
              </small>
            </button>
            {readOnly ? null : (
            <button
              type="button"
              className={styles.resizeHandle}
              aria-label={`Resize ${item.title}`}
              onPointerDown={(event) => beginDrag(event, item, 'resize')}
            />
            )}
          </div>
        );
      })}
    </div>
  );
}
