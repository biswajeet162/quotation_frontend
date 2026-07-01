import { DestroyRef } from '@angular/core';

/** Move an element to document.body so position:fixed overlays cover the full viewport. */
export function teleportElementToBody(element: HTMLElement, destroyRef: DestroyRef): void {
  const parent = element.parentElement;
  const nextSibling = element.nextSibling;

  document.body.appendChild(element);

  destroyRef.onDestroy(() => {
    if (!element.isConnected) {
      return;
    }

    if (parent) {
      parent.insertBefore(element, nextSibling);
      return;
    }

    element.remove();
  });
}
