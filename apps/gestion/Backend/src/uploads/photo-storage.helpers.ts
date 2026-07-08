export function collectRemovedStorageKeys(
  existing: readonly { storageKey: string }[],
  next: readonly { storageKey: string }[],
): string[] {
  const nextKeys = new Set(next.map((photo) => photo.storageKey));
  return existing
    .filter((photo) => !nextKeys.has(photo.storageKey))
    .map((photo) => photo.storageKey);
}

export function collectRemovedKeys(existing: readonly string[], next: readonly string[]): string[] {
  const nextKeys = new Set(next);
  return existing.filter((key) => !nextKeys.has(key));
}

export function buildBuildingDeleteBlockedMessage(spaceCount: number): string {
  return `Ce bâtiment contient ${spaceCount} espace(s). Supprimez-les avant de supprimer le bâtiment.`;
}
