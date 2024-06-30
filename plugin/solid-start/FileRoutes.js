import { lazy } from "solid-js";
import { pageRoutes as routeConfigs } from "./routes";

export function createRoutes() {
  function createRoute(route) {
    return {
      ...route,
      ...(route.$$route ? route.$$route.require().route : undefined),
      info: {
        ...(route.$$route ? route.$$route.require().route.info : {}),
        filesystem: true
      },
      component: route.$component ? lazy(route.$component.import) : undefined,
      children: route.children ? route.children.map(createRoute) : undefined
    };
  }
  const routes = routeConfigs.map(createRoute);
  return routes;
}

/**
 * @type any[]
 */
let routes;

/**
 *
 * Read more: https://docs.solidjs.com/solid-start/reference/routing/file-routes
 */
export const FileRoutes = () => routes || (routes = createRoutes());