/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the COA chart API. Unset: the supplied JSON files are used. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
