import { fileURLToPath } from 'node:url';
import { normalize, relative, resolve } from 'pathe';
import { SolidStartClientFileRouter } from './solid-start/fs-router.js';
import { treeShake } from './vinxi/tree-shake.js';

/**
 * Options for the solid file system router plugin.
 * @typedef {Object} Options
 * @property {string} [dir]
 * @property {string[]} [extensions]
 * @property {import("./vinxi/fs-router.js").BaseFileSystemRouter} [router] - If passed dir and extensions will be ignored.
 */

/**
 * Create a new instance solid filesystem router plugin instance.
 * @param { Options } [options]
 * @returns { import('vite').Plugin }
 */
export default function routes(options) {
	const routesPath = normalize(fileURLToPath(new URL("vinxi/routes.js", import.meta.url)));
	let isBuild;
	/** @type {import("./vinxi/fs-router.js").BaseFileSystemRouter} */
	let router;
	let root;
	return [
		{
			name: "vite-plugin-solid-fsr",
			async configResolved(config) {
				isBuild = config.command === "build";
				root = config.root;
				router = options?.router || new SolidStartClientFileRouter({
					dir: options?.dir ? resolve(config.root, options.dir) : resolve(config.root, 'src', 'routes'),
					extensions: options?.extensions || ['jsx', 'tsx'],
				});
			},
			configureServer(server) {
				router.addEventListener("reload", () => {
					const dependentModules = server.moduleGraph.getModulesByFile(routesPath);
					if (!dependentModules) return;
					dependentModules.forEach(module => server.moduleGraph.invalidateModule(module));
					server.ws.send({ type: "full-reload" });
				});
				server.watcher.on("add", path => router.addRoute(path));
				server.watcher.on("change", path => router.updateRoute(path));
				server.watcher.on("unlink", path => router.removeRoute(path));
			},
			async load(url) {
				const [id, query] = url.split("?");
				if (id === routesPath) {
					const js = jsCode();
					const routes = await router.getRoutes();

					let routesCode = JSON.stringify(routes ?? [], (k, v) => {
						if (v === undefined) {
							return undefined;
						}

						if (k.startsWith("$$")) {
							const buildId = `${v.src}?${v.pick
								.map((/** @type {any} */ p) => `pick=${p}`)
								.join("&")}`;

							/**
							 * @type {{ [key: string]: string }}
							 */
							const refs = {};
							for (var pick of v.pick) {
								refs[pick] = js.addNamedImport(pick, buildId);
							}
							return {
								require: `_$() => ({ ${Object.entries(refs)
									.map(([pick, namedImport]) => `'${pick}': ${namedImport}`)
									.join(", ")} })$_`,
								src: isBuild ? relative(root, buildId) : buildId,
							};
						} else if (k.startsWith("$")) {
							const buildId = `${v.src}?${v.pick
								.map((/** @type {any} */ p) => `pick=${p}`)
								.join("&")}`;
							return {
								src: isBuild ? relative(root, buildId) : buildId,
								build: isBuild
									? `_$() => import('${buildId}')$_`
									: undefined,
								import: `_$(() => { const id = '${relative(
									root,
									buildId,
								)}'; return import('${isBuild ? buildId : "/@fs/" + buildId}') })$_`,
							};
						}
						return v;
					});

					routesCode = routesCode.replaceAll('"_$(', "(").replaceAll(')$_"', ")");

					const code = `${js.getImportStatements()}
					export default ${routesCode}`;
					return code;
				}
			}
		}, 
		treeShake()
  ];
}

function jsCode() {
	let imports = new Map();
	let vars = 0;

	/**
	 * @param {any} p
	 */
	function addImport(p) {
		let id = imports.get(p);
		if (!id) {
			id = {};
			imports.set(p, id);
		}

		let d = "routeData" + vars++;
		id["default"] = d;
		return d;
	}

	/**
	 * @param {string | number} name
	 * @param {any} p
	 */
	function addNamedImport(name, p) {
		let id = imports.get(p);
		if (!id) {
			id = {};
			imports.set(p, id);
		}

		let d = "routeData" + vars++;
		id[name] = d;
		return d;
	}

	const getNamedExport = (/** @type {any} */ p) => {
		let id = imports.get(p);

		delete id["default"];

		return Object.keys(id).length > 0
			? `{ ${Object.keys(id)
					.map((k) => `${k} as ${id[k]}`)
					.join(", ")} }`
			: "";
	};

	const getImportStatements = () => {
		return `${[...imports.keys()]
			.map(
				(i) =>
					`import ${
						imports.get(i).default
							? `${imports.get(i).default}${
									Object.keys(imports.get(i)).length > 1 ? ", " : ""
								}`
							: ""
					} ${getNamedExport(i)} from '${i}';`,
			)
			.join("\n")}`;
	};

	return {
		addImport,
		addNamedImport,
		getImportStatements,
	};
}