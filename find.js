import * as util from "util.js";
import {find as pathfind} from "path_find.js";

/**
 * @typedef {string}
 * 
 * @typedef {object} Opts
 * @property {boolean} root
 * @property {boolean} noroot
 * @property {boolean} canroot
 * @property {boolean} idle
 * @property {string[]} haveall
 * @property {string[]} haveany
 * @property {number} free
 * @property {number} mem
 * @property {number} money
 * @property {string[]} ignore
 * @property {("and"|"or")} join
 * @property {("name"|"mem"|"free")} sort
 * @property {boolean} path
 * @property {boolean} help
 */

const flags = [
    ["root", false, "Include servers that you have root access on."],
    ["noroot", false, "Include servers that you do NOT have root access on."],
    ["canroot", false, "Include servers that you CAN gain root access on."],
    ["idle", false, "Include servers not running any scripts."],
    ["haveall", [], "Include servers with ALL of these scripts on them.", data => [...data.scripts]],
    ["haveany", [], "Include servers with ANY of these scripts on them.", data => [...data.scripts]],
    ["free", -1, "Include servers with at least this amount of free RAM (in GB)."],
    ["mem", -1, "Include servers with at least this amount of max RAM (in GB)."],
    ["money", -1, "Include servers with at least this amount of money (in dollars)."],
    ["ignore", [], "List of servers to exclude from results, even if they match the filter(s).", data => [...data.servers]],
    ["join", "and", "Operator to join filters with. Options are one of: 'and', 'or'.", _ => ["and", "or"]],
    ["sort", "name", "Sort results by one of: 'name', 'mem', 'free'.", _ => ["name", "mem", "free"]],
    ["path", false, "Print path to each server in results."],
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

    switch (opts.sort) {
    case "name":
    case "mem":
    case "free":
        break;

    default:
        ns.tprintf("Invalid value for --sort: '%s'. See --help.\n", opts.join);
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

    const filter = make_filter(ns, opts);

    let results = [];
    if (filter("home")) {
        results.push("home");
    }

    results = find(ns, "home", [], results, filter);

    switch (opts.sort) {
    case "name":
        results.sort();
        break;

    case "mem":
        results.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
        break;

    case "free":
        results.sort((a, b) => (ns.getServerMaxRam(b) - ns.getServerUsedRam(b)) - (ns.getServerMaxRam(a) - ns.getServerUsedRam(a)));
        break;
    }

    if (opts.path) {
        const current = ns.getHostname();
        results = results.map(server => {
            const path = pathfind(ns, server, current, [current], []);
            if (path) {
                return server + ": " + path.join(" -> ");
            } else {
                return server; // no path to self
            }
        });
    }

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

    if (opts.canroot) {
        const tools_available = [
            "BruteSSH.exe",
            "FTPCrack.exe",
            "relaySMTP.exe",
            "HTTPWorm.exe",
            "SQLInject.exe",
        ].filter(exe => ns.fileExists(exe, "home")).length;

        filters.push(server => {
            return ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel(server)
                && ns.getServerNumPortsRequired(server) <= tools_available;
        });
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

    if (opts.mem !== -1) {
        filters.push(server => {
            const max = ns.getServerMaxRam(server);
            return max >= opts.mem;
        });
    }
    
    if (opts.money !== -1) {
        filters.push(server => {
            return ns.getServerMoneyAvailable(server) >= opts.money;
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
