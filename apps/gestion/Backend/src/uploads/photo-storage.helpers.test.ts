import { describe, expect, it } from "vitest";

import {
  buildBuildingDeleteBlockedMessage,
  collectRemovedKeys,
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

  it("collects plain storage keys removed between string arrays", () => {
    const existing = ["vitrine/hero/a.webp", "vitrine/hero/b.webp"];
    const next = ["vitrine/hero/b.webp"];

    expect(collectRemovedKeys(existing, next)).toEqual(["vitrine/hero/a.webp"]);
  });

  it("builds an actionable building delete message with count", () => {
    expect(buildBuildingDeleteBlockedMessage(3)).toBe(
      "Ce bâtiment contient 3 espace(s). Supprimez-les avant de supprimer le bâtiment.",
    );
  });
});
