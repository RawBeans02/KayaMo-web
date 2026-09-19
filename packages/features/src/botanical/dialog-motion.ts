/** Optional web motion for native dialogs. Native callers keep their current behavior. */
const running = new WeakMap<HTMLDialogElement, Animation>();
function webMotion() {
  return document.documentElement.hasAttribute('data-kayamo-web');
}
function reduced() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function openDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return;
  const trigger =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.showModal();
  if (!webMotion() || typeof dialog.animate !== 'function') return;
  const bounds = dialog.getBoundingClientRect();
  const anchor = trigger?.getBoundingClientRect();
  dialog.style.transformOrigin = anchor
    ? `${Math.max(0, Math.min(bounds.width, anchor.x + anchor.width / 2 - bounds.x))}px ${Math.max(0, Math.min(bounds.height, anchor.y + anchor.height / 2 - bounds.y))}px`
    : 'right center';
  const gentle = reduced();
  const start = gentle
    ? { opacity: 0 }
    : { opacity: 0, transform: 'translateX(12px) scale(0.98)' };
  const end = gentle
    ? { opacity: 1 }
    : { opacity: 1, transform: 'translateX(0) scale(1)' };
  dialog.style.willChange = gentle ? 'opacity' : 'transform, opacity';
  running.get(dialog)?.cancel();
  const animation = dialog.animate([start, end], {
    duration: gentle
      ? 150
      : parseFloat(getComputedStyle(dialog).getPropertyValue('--duration-sheet')) || 280,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  });
  running.set(dialog, animation);
  void animation.finished
    .then(() => {
      if (running.get(dialog) === animation) {
        running.delete(dialog);
        dialog.style.willChange = '';
      }
    })
    .catch(() => undefined);
}
export function closeDialog(dialog: HTMLDialogElement | null, onClosed: () => void) {
  if (!dialog || !dialog.open || !webMotion() || typeof dialog.animate !== 'function') {
    dialog?.close();
    onClosed();
    return;
  }
  if (dialog.dataset.closing === 'true') return;
  dialog.dataset.closing = 'true';
  const current = getComputedStyle(dialog);
  const start = { opacity: current.opacity, transform: current.transform };
  running.get(dialog)?.cancel();
  const gentle = reduced();
  dialog.style.willChange = gentle ? 'opacity' : 'transform, opacity';
  const animation = dialog.animate(
    gentle
      ? [{ opacity: start.opacity }, { opacity: 0 }]
      : [start, { opacity: 0, transform: 'translateX(12px) scale(0.98)' }],
    { duration: gentle ? 150 : 180, easing: 'cubic-bezier(0.8, 0, 0.8, 0.2)' },
  );
  running.set(dialog, animation);
  void animation.finished
    .then(() => {
      running.delete(dialog);
      dialog.style.willChange = '';
      delete dialog.dataset.closing;
      dialog.close();
      onClosed();
    })
    .catch(() => {
      delete dialog.dataset.closing;
    });
}
