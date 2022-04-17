import * as util from "util.js";

/**
 * @typedef {string}
 * 
 * @typedef {object} Opts
 * @property {boolean} root
 * @property {boolean} noroot
 * @property {boolean} idle
 * @property {string[]} haveall
 * @property {string[]} haveany
 * @property {number} free
 * @property {string[]} ignore
 * @property {("and"|"or")} join
 * @property {boolean} help
 */

const flags = [
    ["root", false, "Include servers that you have root access on."],
    ["noroot", false, "Include servers that you do NOT have root access on."],
    ["idle", false, "Include servers not running any scripts."],
    ["haveall", [], "Include servers with ALL of these scripts on them.", data => [...data.scripts]],
    ["haveany", [], "Include servers with ANY of these scripts on them.", data => [...data.scripts]],
    ["free", -1, "Include servers with at least this amount of free RAM."],
    ["ignore", [], "List of servers to exclude from results, even if they match the filter(s).", data => [...data.servers]],
    ["join", "and", "Operator to join filters with. Options are one of: 'and', 'or'.", _ => ["and", "or"]],
	["help", false, "Print the help."],
];

export const autocomplete = util.autocompleter(flags);

/**
 * @param {NS} ns
 **/
export async function main(ns) {
	ns.disableLog("ALL");
	ns.enableLog("exec");

    /** @type {Opts} */
	const opts = ns.flags(flags);

	if (opts.help) {
		util.help(ns, flags, "find.js: find servers meeting specified criteria.");
		return;
	}

    switch (opts.join) {
    case "and":
    case "or":
        break;

    default:
        ns.tprintf("Invalid value for --join: '%s'. See --help.\n", opts.join);
        return;
    }

    const filter = make_filter(ns, opts)

    const results = find(ns, "home", [], [], filter);
    for (let server of results) {
        ns.tprint(server);
    }
}

/**
 * @callback Filter
 * @param {string} server
 * @return {boolean}
 */

/** 
 * @param {NS} ns
 * @param {string} source
 * @param {string[]} ignore
 * @param {string[]} results
 * @param {Filter} filter
 * 
 * @return {string[]}
 */
function find(ns, source, ignore, results, filter) {
    const next_ignore = [...ignore, source];
    for (let server of ns.scan(source)) {
        if (ignore.includes(server)) continue;

        if (filter(server)) {
            results.push(server);
        }

        find(ns, server, next_ignore, results, filter);
    }

    return results;
}

/**
 * @param {NS} ns
 * @param {Opts} opts
 **/
function make_filter(ns, opts) {
    /** @type {Filter[]} */
    const filters = [];

    if (opts.root) {
        filters.push(server => ns.hasRootAccess(server));
    }

    if (opts.noroot) {
        filters.push(server => !ns.hasRootAccess(server));
    }

    if (opts.idle) {
        filters.push(server => ns.ps(server).length === 0);
    }

    if (opts.haveall.length !== 0) {
        filters.push(server => {
            for (let s of opts.haveall) {
                if (!ns.fileExists(s, server)) {
                    return false;
                }
            }
            return true;
        });
    }

    if (opts.haveany.length !== 0) {
        filters.push(server => {
            for (let s of opts.haveany) {
                if (ns.fileExists(s, server)) {
                    return true;
                }
            }
            return false;
        });
    }

    if (opts.free !== -1) {
        filters.push(server => {
            const max = ns.getServerMaxRam(server);
            const used = ns.getServerUsedRam(server);
            return (max - used) >= opts.free;
        });
    }
    
    if (opts.ignore.length !== 0) {
        filters.push(server => !opts.ignore.includes(server));
    }

    if (filters.length === 0)  return _ => true;

    switch (opts.join) {
    case "and":
        return server => {
            for (let f of filters) {
                if (!f(server)) return false;
            }
            return true;
        };

    case "or":
        return server => {
            for (let f of filters) {
                if (f(server)) return true;
            }
            return false;
        };
    }
}