/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUINET_HTTP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
