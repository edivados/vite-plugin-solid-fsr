import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { relative } from 'pathe';
import { normalizePath } from 'vite';
import { SolidStartClientFileRouter } from './solid-start-fsr.js';
import { treeShake } from './tree-shake.js';

export { BaseFileSystemRouter } from "./vinxi-fsr.js";

/**
 * Options for the solid file system router plugin.
 * @typedef {Object} Options
 * @property {string} [dir]
 * @property {string[]} [extensions]
 * @property {import("./vinxi-fsr").BaseFileSystemRouter} [router] - If passed dir and extensions will be ignored.
 */

/**
 * Create a new instance solid filesystem router plugin instance.
 * @param { Options } [options]
 * @returns { import('vite').Plugin }
 */
export default function routes(options) {
	const routesPath = normalizePath(fileURLToPath(new URL("routes.js", import.meta.url)));
	let isBuild;
	/** @type {import("./vinxi-fsr").BaseFileSystemRouter} */
	let router;
	let root;
	return [
		{
			name: "vite-plugin-solid-fsr",
			async configResolved(config) {
				isBuild = config.command === "build";
				root = config.root;
				router = options?.router || new SolidStartClientFileRouter({
					dir: normalizePath(options?.dir ? path.resolve(config.root, options.dir) : path.resolve(config.root, 'src', 'routes')),
					extensions: ['jsx', 'tsx'],
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
									? `_$() => import(/* @vite-ignore */ '${buildId}')$_`
									: undefined,
								import: `_$(() => { const id = '${relative(
									root,
									buildId,
								)}'; return import(/* @vite-ignore */ '${isBuild ? buildId : "/@fs/" + buildId}') })$_`,
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