/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TURSO_DATABASE_URL: string;
  readonly VITE_TURSO_AUTH_TOKEN: string;
  readonly VITE_TURSO_DATABASE_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
