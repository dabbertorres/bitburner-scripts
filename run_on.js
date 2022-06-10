import * as util from "util.js";

const flags = [
	["host", ""],
	["threads", 1],
	["dry", false],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
	const opts = ns.flags(flags);
	console.log({opts});

	if (opts._.length === 0) {
		ns.tprint("Must specify a script to run.");
		return;
	}

	const script = opts._[0];
	const script_args = opts._.slice(1);

	if (opts.host === "") {
		opts.host = ns.getHostname();
	} else if (!ns.serverExists(opts.host)) {
		ns.tprintf("No such server '%s'", opts.host);
		return;
	}

	const self = ns.getRunningScript();
	const host = ns.getServer(opts.host);

	const ram_available = calc_available_ram(host, self);
	const ram_per_thread = ns.getScriptRam(script, host.hostname);
	const available_threads = Math.floor(ram_available / ram_per_thread);

	const threads = opts.threads !== 0 ? opts.threads : available_threads;
	const ram_needed = ram_per_thread * (threads !== 0 ? threads : 1);

	if (threads === 0 || available_threads < threads) {
		ns.tprintf("Requested %d thread(s), but there is only enough RAM available for %d thread(s).", threads, available_threads);
		ns.tprintf("RAM per thread: %s", ns.nFormat(ram_per_thread, "0.00ib"));
		ns.tprintf("RAM available:  %s", ns.nFormat(ram_available, "0.00ib"));
		ns.tprintf("RAM needed:     %s", ns.nFormat(ram_needed, "0.00ib"));
		return;
	}

	if (opts.dry) return;

	await ns.scp(opts.script, "home", host.hostname);

	if (host.hostname !== self.server) {
		ns.exec(script, host.hostname, threads, ...script_args);
	} else {
		// reclaim the ram we were using for the "do script"
		ns.spawn(script, threads, ...script_args);
	}
}

/**
 * @param {Server} server
 * @param {RunningScript} self
 * 
 * @return {number}
 */
function calc_available_ram(server, self) {
	let available = server.maxRam - server.ramUsed;
	if (server.hostname === self.server) {
		available += self.ramUsage;
	}
	return available;
}