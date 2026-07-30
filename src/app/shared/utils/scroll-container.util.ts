const DEFAULT_DURATION_MS = 480;

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/** Animate scroll to the bottom of a container. Starts from top when `fromTop` is true. */
export function animateScrollToBottom(
  element: HTMLElement,
  options?: { durationMs?: number; fromTop?: boolean },
): void {
  const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  if (maxScroll <= 0) {
    return;
  }

  if (options?.fromTop !== false) {
    element.scrollTop = 0;
  }

  const start = element.scrollTop;
  const target = maxScroll;
  if (target <= start || durationMs <= 0) {
    element.scrollTop = target;
    return;
  }

  const startTime = performance.now();

  const step = (now: number): void => {
    const progress = Math.min((now - startTime) / durationMs, 1);
    element.scrollTop = start + (target - start) * easeOutCubic(progress);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.scrollTop = target;
    }
  };

  requestAnimationFrame(step);
}

/** Wait for layout, then scroll a container to its latest content at the bottom. */
export function scrollToBottomAfterRender(
  getElement: () => HTMLElement | null | undefined,
  options?: { durationMs?: number; fromTop?: boolean },
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const element = getElement();
      if (element) {
        animateScrollToBottom(element, options);
      }
    });
  });
}

/**
 * Scroll the detail panel to the latest entry with a visible fast animation,
 * then re-sync after async sections render (quotation history, finalization, etc.).
 */
export function scheduleDetailScrollToLatest(
  getElement: () => HTMLElement | null | undefined,
  options?: { durationMs?: number },
): void {
  scrollToBottomAfterRender(getElement, { ...options, fromTop: true });
  for (const delayMs of [220, 520]) {
    setTimeout(() => {
      scrollToBottomAfterRender(getElement, { durationMs: 0, fromTop: false });
    }, delayMs);
  }
}
