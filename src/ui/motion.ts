/** Explicit JS scrolling must respect the same preference as the rendered scenes. */
export const scrollBehavior = ():ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
