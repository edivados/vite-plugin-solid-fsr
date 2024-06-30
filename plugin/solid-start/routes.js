import fileRoutes from "../vinxi/routes";

export const pageRoutes = defineRoutes(fileRoutes);

function defineRoutes(fileRoutes) {
  function processRoute(routes, route, id, full) {
    const parentRoute = Object.values(routes).find(o => {
      return id.startsWith(o.id + "/");
    });

    if (!parentRoute) {
      routes.push({ ...route, id, path: id.replace(/\/\([^)/]+\)/g, "").replace(/\([^)/]+\)/g, "") });
      return routes;
    }
    processRoute(
      parentRoute.children || (parentRoute.children = []),
      route,
      id.slice(parentRoute.id.length),
      full
    );

    return routes;
  }

  return fileRoutes
    .sort((a, b) => a.path.length - b.path.length)
    .reduce((prevRoutes, route) => {
      return processRoute(prevRoutes, route, route.path, route.path);
    }, []);
}
