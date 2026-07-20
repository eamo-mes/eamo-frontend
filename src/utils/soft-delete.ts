export interface SoftDeletedRecord {
  deleted_at?: null | string;
}

export function isSoftDeleted(record: SoftDeletedRecord): boolean {
  return Boolean(record.deleted_at);
}

export function softDeletedRowClass(record: SoftDeletedRecord): string {
  return isSoftDeleted(record) ? 'bg-gray-50 opacity-60 grayscale' : '';
}
