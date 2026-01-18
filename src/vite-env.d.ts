/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_DEXIE_CLOUD_URL: string;
    readonly VITE_AI_DEFAULT_PROVIDER?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
