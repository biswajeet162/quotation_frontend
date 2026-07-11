/** Opens the public image viewer for an attachment id in a new browser tab. */
export function openPublicImages(imageId: string): void {
  if (!imageId) {
    return;
  }
  window.open(`/images/${imageId}`, '_blank', 'noopener,noreferrer');
}
