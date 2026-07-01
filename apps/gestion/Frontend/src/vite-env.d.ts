/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_MODE?: "local" | "sso";
  readonly VITE_CENTRALE_HOME_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
