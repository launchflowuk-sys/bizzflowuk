export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter, setUnauthorizedHandler, setTenantIdGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
