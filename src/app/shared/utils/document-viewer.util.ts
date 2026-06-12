export type DocumentViewerKind = 'pdf' | 'docx' | 'excel' | 'pptx' | 'text' | 'unsupported';

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

function normalizeMime(contentType: string): string {
  return (contentType || '').toLowerCase().split(';')[0].trim();
}

export function resolveDocumentViewerKind(
  fileName: string,
  contentType: string,
): DocumentViewerKind {
  const ext = extension(fileName);
  const mime = normalizeMime(contentType);

  if (ext === 'pdf' || mime === 'application/pdf' || mime === 'application/x-pdf') {
    return 'pdf';
  }

  if (
    ext === 'docx' ||
    mime === 'application/msword' ||
    mime.startsWith('application/vnd.ms-word') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return ext === 'doc' ? 'unsupported' : 'docx';
  }

  if (
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext) ||
    mime.startsWith('application/vnd.ms-excel') ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml') ||
    mime === 'text/csv' ||
    mime.startsWith('application/vnd.oasis.opendocument.spreadsheet')
  ) {
    return 'excel';
  }

  if (
    ext === 'pptx' ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime.startsWith('application/vnd.openxmlformats-officedocument.presentationml')
  ) {
    return ext === 'ppt' ? 'unsupported' : 'pptx';
  }

  if (
    ['txt', 'rtf', 'log', 'md'].includes(ext) ||
    mime.startsWith('text/') ||
    mime === 'application/rtf'
  ) {
    return 'text';
  }

  return 'unsupported';
}

export function documentTypeLabel(kind: DocumentViewerKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'Word';
    case 'excel':
      return 'Spreadsheet';
    case 'pptx':
      return 'PowerPoint';
    case 'text':
      return 'Text';
    default:
      return 'Document';
  }
}
