/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_CLOUD_FUNCTIONS_URL: string
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}