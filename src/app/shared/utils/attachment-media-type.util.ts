import { TimelineAttachmentMediaType } from '../../core/models/inquiry-timeline.model';

export function isDocumentAttachmentType(contentType: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (/\.(pdf|docx?|xlsx?|pptx?|ppsx?|txt|csv|rtf|odt|ods)$/.test(lower)) {
    return true;
  }
  return (
    contentType === 'application/pdf' ||
    contentType === 'application/msword' ||
    contentType === 'text/plain' ||
    contentType === 'text/csv' ||
    contentType.startsWith('application/vnd.openxmlformats-officedocument.') ||
    contentType.startsWith('application/vnd.oasis.opendocument.')
  );
}

export function resolveAttachmentMediaType(file: File): TimelineAttachmentMediaType | null {
  if (isDocumentAttachmentType(file.type, file.name)) {
    return 'DOCUMENT';
  }
  if (file.type.startsWith('image/')) {
    return 'IMAGE';
  }
  if (file.type.startsWith('video/')) {
    return 'VIDEO';
  }
  if (file.type.startsWith('audio/')) {
    return 'AUDIO';
  }
  const lower = file.name.toLowerCase();
  if (/\.(jpe?g|png|gif|webp)$/.test(lower)) {
    return 'IMAGE';
  }
  if (/\.(mp4|mov)$/.test(lower)) {
    return 'VIDEO';
  }
  if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) {
    return 'AUDIO';
  }
  if (/\.webm$/.test(lower)) {
    return file.type.startsWith('audio/') ? 'AUDIO' : 'VIDEO';
  }
  return null;
}
