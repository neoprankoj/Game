import type { RouteContract } from './define';
import { healthRoute, readyRoute } from './system';

export { defineRoute, type HttpMethod, type ResponseContract, type RouteContract } from './define';
export { HealthResponse, ReadyResponse, healthRoute, readyRoute } from './system';

/** Every route of the API. New domain routes are added here by their Parts. */
export const routes: readonly RouteContract[] = [healthRoute, readyRoute];
