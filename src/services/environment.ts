/** Static builds never probe an API. Connected features are a separate opt-in path. */
export const STATIC_BUILD=import.meta.env.VITE_ALEM_STATIC==='true';
