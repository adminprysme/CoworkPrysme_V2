import { describe, expect, it } from "vitest";

import {
  buildBuildingDeleteBlockedMessage,
  collectRemovedStorageKeys,
} from "./photo-storage.helpers.js";

describe("photo-storage.helpers", () => {
  it("collects storage keys removed between photo arrays", () => {
    const existing = [{ storageKey: "buildings/a/1.webp" }, { storageKey: "buildings/a/2.webp" }];
    const next = [{ storageKey: "buildings/a/2.webp" }];

    expect(collectRemovedStorageKeys(existing, next)).toEqual(["buildings/a/1.webp"]);
  });

  it("returns empty when no photos were removed", () => {
    const photos = [{ storageKey: "spaces/b/1.webp" }];
    expect(collectRemovedStorageKeys(photos, photos)).toEqual([]);
  });

  it("builds an actionable building delete message with count", () => {
    expect(buildBuildingDeleteBlockedMessage(3)).toBe(
      "Ce bâtiment contient 3 espace(s). Supprimez-les avant de supprimer le bâtiment.",
    );
  });
});
