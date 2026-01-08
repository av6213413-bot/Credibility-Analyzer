export const ROUTES = {
  HOME: '/',
  ANALYSIS: '/analysis',
  HISTORY: '/history',
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
