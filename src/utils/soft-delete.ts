export interface SoftDeletedRecord {
  deleted_at?: null | string;
}

export function isSoftDeleted(record: SoftDeletedRecord): boolean {
  return Boolean(record?.deleted_at);
}

export function softDeletedRowClass(record: SoftDeletedRecord): string {
  return isSoftDeleted(record) ? 'bg-gray-50 opacity-60 grayscale' : '';
}

/**
 * Automatically sorts array of records so that soft-deleted rows (deleted_at is present) are moved to the bottom.
 */
export function sortBySoftDeleted<T extends SoftDeletedRecord>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aDeleted = isSoftDeleted(a);
    const bDeleted = isSoftDeleted(b);
    if (aDeleted && !bDeleted) return 1;
    if (!aDeleted && bDeleted) return -1;
    return 0;
  });
}
