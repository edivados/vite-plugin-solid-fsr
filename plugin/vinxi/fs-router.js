import { init, parse } from "es-module-lexer";
import esbuild from "esbuild";
import fg from "fast-glob";
import fs from "fs";
import micromatch from "micromatch";
import { posix } from "path";
import { normalize } from "pathe";

/**
 *
 * @param {string} path
 * @returns {string[]}
 */
export const glob = (path) => fg.sync(path, { absolute: true });

/** @typedef {{ dir: string; extensions: string[] }} FileSystemRouterConfig */
/** @typedef {{ path: string } & any} Route */

/**
 *
 * @param {string} src
 * @param {FileSystemRouterConfig} config
 * @returns
 */
export function cleanPath(src, config) {
	return src
		.slice(config.dir.length)
		.replace(new RegExp(`\.(${(config.extensions ?? []).join("|")})$`), "");
}

/**
 *
 * @param {string} src
 * @returns
 */
export function analyzeModule(src) {
	return parse(
		esbuild.transformSync(fs.readFileSync(src, "utf-8"), {
			jsx: "transform",
			format: "esm",
			loader: "tsx",
		}).code,
		src,
	);
}

export class BaseFileSystemRouter extends EventTarget {
	/** @type {any[]} */
	routes;

	/** @type {FileSystemRouterConfig} */
	config;

	/**
	 *
	 * @param {FileSystemRouterConfig} config
	 */
	constructor(config) {
		super();
		this.routes = [];
		this.config = config;
	}

	glob() {
		return (
			posix.join(fg.convertPathToPattern(this.config.dir), "**/*") +
			`.{${this.config.extensions.join(",")}}`
		);
	}

	/**
	 * @returns {Promise<any[]>}
	 */
	async buildRoutes() {
		await init;
		for (var src of glob(this.glob())) {
			await this.addRoute(src);
		}

		return this.routes;
	}

	/**
	 *
	 * @param {*} src
	 * @returns {boolean}
	 */
	isRoute(src) {
		return Boolean(micromatch(src, this.glob())?.length);
	}

	/**
	 *
	 * @param {*} src
	 * @returns {string}
	 */
	toPath(src) {
		throw new Error("Not implemented");
	}

	/**
	 *
	 * @param {*} src
	 * @returns {Route | null}
	 */
	toRoute(src) {
		let path = this.toPath(src);

		if (path === undefined) {
			return null;
		}

		const [_, exports] = analyzeModule(src);

		if (!exports.find((e) => e.n === "default")) {
			console.warn("No default export", src);
		}

		return {
			$component: {
				src: src,
				pick: ["default", "$css"],
			},
			path,
			filePath: src,
		};
	}

	/**
	 *
	 * @param {Route} route
	 */
	_addRoute(route) {
		this.routes = this.routes.filter((r) => r.path !== route.path);
		this.routes.push(route);
	}

	/**
	 *
	 * @param {string} src
	 */
	async addRoute(src) {
		src = normalize(src);
		if (this.isRoute(src)) {
			try {
				const route = await this.toRoute(src);
				if (route) {
					this._addRoute(route);
					this.reload(route);
				}
			} catch (e) {
				console.error(e);
			}
		}
	}

	/**
	 *
	 * @param {string} route
	 */
	reload(route) {
		this.dispatchEvent(
			new Event("reload", {
				// @ts-ignore
				detail: {
					route,
				},
			}),
		);
	}

	/**
	 *
	 * @param {string} src
	 */
	async updateRoute(src) {
		src = normalize(src);
		if (this.isRoute(src)) {
			try {
				const route = await this.toRoute(src);
				if (route) {
					this._addRoute(route);
					this.reload(route);
				}
			} catch (e) {
				console.error(e);
			}
		}
	}

	/**
	 *
	 * @param {string} src
	 * @returns
	 */
	removeRoute(src) {
		console.log("remove", src);
		src = normalize(src);
		if (this.isRoute(src)) {
			const path = this.toPath(src);
			if (path === undefined) {
				return;
			}
			this.routes = this.routes.filter((r) => r.path !== path);
			this.dispatchEvent(new Event("reload", {}));
		}
	}

	/** @type {Promise<any[]> | undefined} */
	buildRoutesPromise = undefined;

	async getRoutes() {
		if (!this.buildRoutesPromise) {
			this.buildRoutesPromise = this.buildRoutes();
		}
		await this.buildRoutesPromise;
		return this.routes;
	}
}