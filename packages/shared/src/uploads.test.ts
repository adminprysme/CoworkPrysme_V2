import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildBuildingPhotoStorageKey,
  isValidBuildingPhotoStorageKey,
  mediaPathFromStorageKey,
  resolveStorageKeyAbsolutePath,
  resolveUploadsDir,
} from "./uploads.js";

const BUILDING_ID = "507f1f77bcf86cd799439011";
const FILE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("uploads helpers", () => {
  it("validates building photo storage keys", () => {
    const key = buildBuildingPhotoStorageKey(BUILDING_ID, FILE_ID);
    expect(isValidBuildingPhotoStorageKey(key)).toBe(true);
    expect(isValidBuildingPhotoStorageKey("../etc/passwd")).toBe(false);
    expect(isValidBuildingPhotoStorageKey(`buildings/${BUILDING_ID}/../../secret.webp`)).toBe(
      false,
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

  it("defaults uploads dir outside repo in development", () => {
    const resolved = resolveUploadsDir({ NODE_ENV: "development" }, "/app/apps/gestion/Backend");
    expect(resolved).toBe(path.resolve("/app/apps/gestion/Backend", "../../../uploads"));
  });

  it("requires UPLOADS_DIR in production", () => {
    expect(() => resolveUploadsDir({ NODE_ENV: "production" }, "/app")).toThrow();
  });
});
