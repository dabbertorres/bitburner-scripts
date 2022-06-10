import * as util from "util.js";
import { find } from "find.js";

/**
 * @typedef {object} Opts
 * @property {number} port
 * @property {number} period
 * @property {boolean} help
 */
const flags = [
	["port", 20, "Netscript Port to serve API on."],
	["period", 10_000, "Sync period (in milliseconds)."],
	["help", false, "Print the help."],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	/** @type Opts */
	const opts = ns.flags(flags);

	if (opts.help) {
		util.help(ns, flags, "orchestrator.js: orchestrate execution of hacking scripts across a network\n\n");
		return;
	}

	const hack_ram = ns.getScriptRam("hack.js");
	const grow_ram = ns.getScriptRam("grow.js");
	const weak_ram = ns.getScriptRam("weak.js");

	const handle = ns.getPortHandle(opts.port);
	const serve_api = api_handler(ns, handle);

	/** @type {Server[]} */
	let targets = [];

	while (true) {
		// discover initial servers
		const servers = find_compute_resources(ns).map(ns.getServer);

		serve_api(servers, targets);

		const total_max_ram = servers.map(server => server.maxRam).reduce((prev, curr) => prev + curr, 0);
		const total_used_ram = servers.map(server => server.ramUsed).reduce((prev, curr) => prev + curr, 0);
		let total_free_ram = total_max_ram - total_used_ram;

		const running_scripts = servers.map(server => ns.ps(server.hostname))
									   .reduce((prev, curr) => prev.concat(curr));

		ns.print(`RAM stats: max: ${total_max_ram}; used: ${total_used_ram}; free: ${total_free_ram}`);

		/** @type {Server[]} */
		const fulfilled = [];

		for (let target of targets) {
			// if we already hitting this target, drop it
			if (running_scripts.some(info => info.args[0] === target.hostname)) {
				ns.print(`Already hacking ${target.hostname}; dropping`);
				fulfilled.push(target);
				continue;
			}

			const goal = Math.max(target.moneyMax / 1000, 100_000);
			const factor = 2;

			let hack_threads = Math.max(Math.floor(ns.hackAnalyzeThreads(target.hostname, goal)), 1);
			let grow_threads = Math.max(Math.ceil(ns.growthAnalyze(target.hostname, factor, 1)), 1);
			let weak_threads = calc_weak_threads(ns, target.hostname, 1, hack_threads, grow_threads);
			
			const need_ram = weak_ram * weak_threads + grow_ram * grow_threads + hack_ram * hack_threads;
			if (total_free_ram < need_ram) {
				ns.print(`Not enough RAM available to hack ${target.hostname} (need ${need_ram}, have ${total_free_ram})`);
				continue;
			}

			/** @type {number[]} */
			const pids = [];

			try {
				for (let host of servers) {
					let free_ram = host.maxRam - host.ramUsed;

					const launch = async (script, threads_needed, ram_cost) => {
						if (free_ram >= ram_cost && threads_needed > 0) {
							if (!ns.fileExists(script, host.hostname)) {
								await ns.scp(script, "home", host.hostname);
							}
		
							const threads = Math.min(Math.floor(free_ram / ram_cost), threads_needed);
		
							ns.print(`exec'ing ${script} with ${threads} threads on ${host.hostname} targeting ${target.hostname}`);
							const pid = ns.exec(script, host.hostname, threads, target.hostname);
							if (pid === 0) throw `failed to start ${script} on ${host.hostname}`;
	
							pids.push(pid);
							free_ram -= ram_cost * threads;

							return threads_needed - threads;
						}

						return threads_needed;
					};

					weak_threads = await launch("weak.js", weak_threads, weak_ram);
					grow_threads = await launch("grow.js", grow_threads, grow_ram);
					hack_threads = await launch("hack.js", hack_threads, hack_ram);

					ns.print(`threads for ${target.hostname}: ${weak_threads} weak; ${grow_threads} grow; ${hack_threads} hack`);

					if (weak_threads === 0 && grow_threads === 0 && hack_threads === 0)
						break;
				}
	
				fulfilled.push(target);
				total_free_ram -= need_ram; } catch (ex) {
				for (let pid of pids) {
					ns.kill(pid);
				}

				ns.print(ex);
			}
		}

		targets = targets.filter(server => !fulfilled.includes(server));
	
		await ns.sleep(opts.period);
	}
}

function calc_weak_threads(ns, target, cpuCores, hack_threads, grow_threads) {
	const hack_sec = ns.hackAnalyzeSecurity(hack_threads, target);
	const grow_sec = ns.growthAnalyzeSecurity(grow_threads, target, cpuCores);

	const hack_t = ns.getHackTime(target);
	const grow_t = ns.getGrowTime(target);
	const weak_t = ns.getWeakenTime(target);

	const hacks_per_weak = weak_t / hack_t;
	const grows_per_weak = weak_t / grow_t;

	const increase = hack_sec * hacks_per_weak + grow_sec * grows_per_weak;

	let threads = 0;
	let affect = 0;
	while (affect < increase) {
		threads++;
		affect = ns.weakenAnalyze(threads, cpuCores);
	}
	return Math.max(Math.ceil(threads), 1);
}

/**
 * @param {NS} ns
 * @param {NetscriptPort} handle
 */
function api_handler(ns, handle) {
	/**
	 * @param {Server[]} servers
	 * @param {Server[]} targets
	 */
	return (servers, targets) => {
		while (!handle.empty()) {
			const data = handle.read();
	
			/** @type {APIMessage} */
			const msg = JSON.parse(data);
	
			switch (msg.type) {
			case "new_server":
				const server = ns.getServer(msg.data.hostname);
				servers.push(server);
				break;
	
			case "new_hack":
				const target = ns.getServer(msg.data.target);
				targets.push(target);
				break;
	
			default:
				ns.print(`unknown api message: ${msg.type}`);
				break;
			}
		}
	};
}

/**
 * @typedef {object} NewServerMessage
 * @property {string} hostname
 */

/**
 * @typedef {object} NewHackJob
 * @property {string} target
 */

/**
 * @typedef {object} APIMessage
 * @property {"new_server" | "new_hack"} type
 * @property {NewServerMessage | NewHackJob} data
 */

/**
 * @param {NS} ns 
 * 
 * @returns {string[]}
 */
function find_compute_resources(ns) {
	const hacknet_servers = [];
	for (let i = 0; i < ns.hacknet.numNodes(); ++i) {
		hacknet_servers.push("hacknet-node-" + i);
	}

    return find(ns, "home", hacknet_servers, [], server => ns.hasRootAccess(server) && ns.getServerMaxRam(server) > 0);
}