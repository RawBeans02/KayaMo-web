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
  source_id?: string | null;
};

export function TodosTimeline({
  blocks,
  ghosts = [],
  conflicts,
  selectedId,
  readOnly = false,
  doneIds,
  nowMin = null,
  dayStart = DAY_START_MIN,
  dayEnd = DAY_END_MIN,
  hourPx = HOUR_PX,
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
  doneIds?: Set<string>;
  nowMin?: number | null;
  dayStart?: number;
  dayEnd?: number;
  hourPx?: number;
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
      source_id: block.source_id,
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

  function kindOf(item: TimelineItem): 'fixed' | 'done' | 'planned' | 'proposed' {
    if (item.ghost) return 'proposed';
    if (item.source_id && doneIds?.has(item.source_id)) return 'done';
    if (item.locked || item.flexibility === 'FIXED' || item.flexibility === 'PROTECTED') return 'fixed';
    return 'planned';
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
      const delta = ((ev.clientY - originY) / hourPx) * 60;
      const shifted = shiftTimeRange(origin.start, origin.end, delta, mode, dayStart, dayEnd);
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
    const next = shiftTimeRange(pos.start, pos.end, delta, event.shiftKey ? 'resize' : 'move', dayStart, dayEnd);
    setDrafts((current) => ({ ...current, [item.id]: { start: next.startMin, end: next.endMin } }));
    if (item.ghost) onGhostCommit?.(item.id, next.startMin, next.endMin);
    else onCommit(item.id, next.startMin, next.endMin);
  }

  const hours = hourMarks(dayStart, dayEnd);
  const innerHeight = ((dayEnd - dayStart) / 60) * hourPx;
  const showNow =
    nowMin !== null && nowMin >= dayStart && nowMin <= dayEnd
      ? blockTopPx(nowMin, dayStart, hourPx)
      : null;

  return (
    <div
      ref={rootRef}
      className={styles.timeline}
      data-desk=""
      tabIndex={0}
      role="list"
      aria-label={
        readOnly
          ? 'Day timeline'
          : 'Day timeline. Arrow keys move a selected block 15 minutes. Shift+arrow resizes. Delete removes it.'
      }
      style={{ height: innerHeight }}
      onKeyDown={readOnly ? undefined : onKeyDown}
      onDoubleClick={
        readOnly
          ? undefined
          : (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const start = yToMinutes(event.clientY - rect.top, dayStart, hourPx);
              onCreateAt(Math.max(dayStart, Math.min(dayEnd - 30, start)));
            }
      }
    >
      {hours.map((mark) => (
        <div
          key={mark}
          className={styles.hourLane}
          style={{ top: blockTopPx(mark, dayStart, hourPx), height: hourPx }}
        >
          <span>{minutesToLabel(mark)}</span>
        </div>
      ))}
      {showNow !== null ? (
        <div className={styles.nowLine} style={{ top: showNow }}>
          <span className={styles.nowTag}>now</span>
        </div>
      ) : null}
      {items.map((item) => {
        const pos = shown(item);
        const kind = kindOf(item);
        const flag = kind === 'fixed' ? '◆' : kind === 'done' ? '✓' : item.ghost ? 'from Mus' : '';
        return (
          <div
            key={item.id}
            className={styles.timeBlock}
            data-selected={selectedId === item.id ? 'true' : undefined}
            data-conflict={conflicts.has(item.id) ? 'true' : undefined}
            data-locked={item.locked ? 'true' : undefined}
            data-flex={item.flexibility}
            data-ghost={item.ghost ? 'true' : undefined}
            data-kind={kind}
            style={{
              top: blockTopPx(pos.start, dayStart, hourPx),
              height: blockHeightPx(pos.start, pos.end, hourPx),
            }}
          >
            <button
              type="button"
              className={styles.timeBlockHit}
              onClick={() => onSelect(item.id)}
              onPointerDown={readOnly ? undefined : (event) => beginDrag(event, item, 'move')}
            >
              <strong>
                {item.title}
                {flag ? <span className={styles.timeBlockFlag}> {flag}</span> : null}
              </strong>
              <small>
                {minutesToLabel(pos.start)}–{minutesToLabel(pos.end)}
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
