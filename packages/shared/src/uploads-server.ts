import path from "node:path";

import { isValidEntityPhotoStorageKey } from "./uploads.js";

export function resolveStorageKeyAbsolutePath(
  uploadsDir: string,
  storageKey: string,
): string | null {
  if (!isValidEntityPhotoStorageKey(storageKey)) {
    return null;
  }

  const absoluteUploads = path.resolve(uploadsDir);
  const absoluteTarget = path.resolve(absoluteUploads, storageKey);
  const uploadsPrefix = absoluteUploads.endsWith(path.sep)
    ? absoluteUploads
    : `${absoluteUploads}${path.sep}`;

  if (!absoluteTarget.startsWith(uploadsPrefix)) {
    return null;
  }

  return absoluteTarget;
}

export function resolveUploadsDir(env: NodeJS.ProcessEnv, cwd: string): string {
  if (env.UPLOADS_DIR?.trim()) {
    return path.resolve(env.UPLOADS_DIR.trim());
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Invalid or missing environment configuration");
  }

  return path.resolve(cwd, "../../../uploads");
}
