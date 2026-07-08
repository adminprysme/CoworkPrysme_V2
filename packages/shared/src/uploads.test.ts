import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveStorageKeyAbsolutePath, resolveUploadsDir } from "./uploads-server.js";
import {
  buildBuildingPhotoStorageKey,
  buildEntityPhotoStorageKey,
  buildSpacePhotoStorageKey,
  isValidBuildingPhotoStorageKey,
  isValidEntityPhotoStorageKey,
  isValidSpacePhotoStorageKey,
  mediaPathFromStorageKey,
} from "./uploads.js";
import { buildVitrineImageStorageKey } from "./vitrine-content.js";

const BUILDING_ID = "507f1f77bcf86cd799439011";
const SPACE_ID = "607f1f77bcf86cd799439022";
const FILE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("uploads helpers", () => {
  it("validates entity photo storage keys for buildings and spaces", () => {
    const buildingKey = buildBuildingPhotoStorageKey(BUILDING_ID, FILE_ID);
    const spaceKey = buildSpacePhotoStorageKey(SPACE_ID, FILE_ID);

    expect(isValidEntityPhotoStorageKey(buildingKey)).toBe(true);
    expect(isValidEntityPhotoStorageKey(spaceKey)).toBe(true);
    expect(isValidBuildingPhotoStorageKey(buildingKey)).toBe(true);
    expect(isValidSpacePhotoStorageKey(spaceKey)).toBe(true);
    expect(isValidBuildingPhotoStorageKey(spaceKey)).toBe(false);
    expect(isValidEntityPhotoStorageKey("../etc/passwd")).toBe(false);
    expect(isValidEntityPhotoStorageKey(`buildings/${BUILDING_ID}/../../secret.webp`)).toBe(false);
  });

  it("builds entity storage keys with explicit prefixes", () => {
    expect(buildEntityPhotoStorageKey("spaces", SPACE_ID, FILE_ID)).toBe(
      `spaces/${SPACE_ID}/${FILE_ID}.webp`,
    );
  });

  it("builds media paths from storage keys", () => {
    const key = buildBuildingPhotoStorageKey(BUILDING_ID, FILE_ID);
    expect(mediaPathFromStorageKey(key)).toBe(`/media/${key}`);
  });

  it("resolves storage keys under uploads dir only", () => {
    const uploadsDir = "/data/uploads";
    const key = buildBuildingPhotoStorageKey(BUILDING_ID, FILE_ID);
    expect(resolveStorageKeyAbsolutePath(uploadsDir, key)).toBe(path.resolve(uploadsDir, key));
    expect(resolveStorageKeyAbsolutePath(uploadsDir, "../../../etc/passwd")).toBeNull();
  });

  it("resolves vitrine image storage keys under uploads dir", () => {
    const uploadsDir = "/data/uploads";
    const key = buildVitrineImageStorageKey("hero", FILE_ID);
    expect(resolveStorageKeyAbsolutePath(uploadsDir, key)).toBe(path.resolve(uploadsDir, key));
  });

  it("defaults uploads dir outside repo in development", () => {
    const resolved = resolveUploadsDir({ NODE_ENV: "development" }, "/app/apps/gestion/Backend");
    expect(resolved).toBe(path.resolve("/app/apps/gestion/Backend", "../../../uploads"));
  });

  it("requires UPLOADS_DIR in production", () => {
    expect(() => resolveUploadsDir({ NODE_ENV: "production" }, "/app")).toThrow();
  });
});
