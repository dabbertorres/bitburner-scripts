import { find } from "find.js";
import * as util from "util.js";

/**
 * @typedef {object} Opts
 * @property {string} script
 * @property {string} arg
 * @property {number} money_max
 * @property {("and"|"or")} join
 * @property {boolean} help
 */
const flags = [
	["script", "", "Include only processes using this script."],
	["arg", "", "Include only processes with this as an argument."],
	//["money_max", -1, "Include processes on servers with money no more than this."],
    ["join", "and", "Operator to join filters with. Options are one of: 'and', 'or'.", _ => ["and", "or"]],
	["help", false, "Print this help message"],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
	/** @type Opts */
	const opts = ns.flags(flags);
	if (opts.help) {
		util.help(ns, flags, "List processes across all servers.");
		return;
	}

	const filter = make_filter(ns, opts)
	const processes = [];

	find(ns, "home", [], [], srv => {
		const info = ns.ps(srv).filter(filter);
		processes.push({server: srv, ps: info});
	});

	const self = ns.getRunningScript();
	processes.push({server: "home", ps: ns.ps("home").filter(filter).filter(proc => proc.pid !== self.pid)});

	for (let srv of processes) {
		for (let proc of srv.ps) {
			ns.tprintf("%s: [%d] (%d) %s [%s]", srv.server, proc.pid, proc.threads, proc.filename, proc.args.join(","));
		}
	}
}

/**
 * @callback Filter
 * @param {ProcessInfo} server
 * @return {boolean}
 */

/**
 * @param {NS} ns
 * @param {Opts} opts
 * 
 * @return {Filter}
 */
function make_filter(ns, opts) {
    /** @type {Filter[]} */
	const filters = [];

	if (opts.script !== "") {
		filters.push(proc => proc.filename === opts.script);
	}

	if (opts.arg !== "") {
		filters.push(proc => proc.args.some(a => a.toString().includes(opts.arg)));
	}

    if (filters.length === 0) return _ => true;

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