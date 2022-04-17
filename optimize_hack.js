import * as util from "util.js";

const flags = [
	["hack", "hack.js", "hack() script to use. Optional.", data => [...data.scripts]],
	["grow", "grow.js", "grow() script to use. Optional.", data => [...data.scripts]],
	["weak", "weak.js", "weaken() scripting. Optional.", data => [...data.scripts]],
	["factor", 1, "Set to use a percentage of the threads that would be used for maximum profit. Optional."],
	["target", "", "Target server of hack/grow/weaken. Required.", data => [...data.servers]],
	["host", "", "Server that will run hack/grow/weaken. Optional. Default: the current server.", data => [...data.servers]],
	["dry", false, "Do everything but run hack/grow/weaken. Used for calculating resource usage."],
	["help", false, "Print the help."],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
	const opts = ns.flags(flags);

	if (opts.help) {
		util.help(ns, flags, "optimize_hack.js: Calculate and run the optimal amount of threads for hack()/grow()/weaken() for maximum profit.\n\n");
		return;
	}

	if (opts.host === "") opts.host = ns.getHostname();
	const host = ns.getServer(opts.host);

	const goal = calc_hack_goal(ns, opts.target, 1000);
	
	const total_hack_threads = calc_hack_threads(ns, opts.target, goal.amount);
	const total_grow_threads = calc_grow_threads(ns, opts.target, host, goal.factor);
	const total_weak_threads = calc_weak_threads(ns, opts.target, host, total_hack_threads, total_grow_threads);

	const hack_threads = Math.max(Math.floor(opts.factor * total_hack_threads), 1);
	const grow_threads = Math.max(Math.ceil(opts.factor * total_grow_threads), 1);
	const weak_threads = Math.max(Math.ceil(opts.factor * total_weak_threads), 1);

	const total_hack_ram = ns.getScriptRam(opts.hack, "home");
	const total_grow_ram = ns.getScriptRam(opts.grow, "home");
	const total_weak_ram = ns.getScriptRam(opts.weak, "home");
	
	const hack_ram = total_hack_ram * hack_threads;
	const grow_ram = total_grow_ram * grow_threads;
	const weak_ram = total_weak_ram * weak_threads;

	const need_ram = hack_ram + grow_ram + weak_ram;
	let free_ram = host.maxRam - host.ramUsed;

	if (hack_threads === total_hack_threads) {
		ns.tprintf("Will use %d hack, %d grow, %d weak threads", hack_threads, grow_threads, weak_threads);
		ns.tprintf("Will use %s GiB RAM (hack=%s, grow=%s, weak=%s)", need_ram.toFixed(2), hack_ram.toFixed(2), grow_ram.toFixed(2), weak_ram.toFixed(2));
	} else {
		ns.tprintf("Will use %d hack, %d grow, %d weak threads", hack_threads, grow_threads, weak_threads);
		ns.tprintf("Will use %s GiB RAM (hack=%s, grow=%s, weak=%s)", need_ram.toFixed(2), hack_ram.toFixed(2), grow_ram.toFixed(2), weak_ram.toFixed(2));
	}

	const running_hack = ns.getRunningScript(opts.hack, opts.host, opts.target);
	if (running_hack) {
		free_ram += running_hack.ramUsage * running_hack.threads;
	}

	const running_grow = ns.getRunningScript(opts.grow, opts.host, opts.target);
	if (running_grow) {
		free_ram += running_grow.ramUsage * running_grow.threads;
	}

	const running_weak = ns.getRunningScript(opts.weak, opts.host, opts.target);
	if (running_weak) {
		free_ram += running_weak.ramUsage * running_weak.threads;
	}

	if (free_ram < need_ram) {
		const total_need_ram = total_hack_ram * total_hack_threads + total_grow_ram * total_grow_threads + total_weak_ram * total_weak_threads;
		ns.tprintf("Not enough RAM to run on '%s'. Need %s GiB, but only %s GiB is available.", opts.host, need_ram.toFixed(2), free_ram.toFixed(2));
		ns.tprintf("Try using --factor to use a percentage of the goal ('--factor %f' should fit on this server).", free_ram / total_need_ram);
		return;
	}

	if (opts.dry) return;

	if (running_hack) ns.kill(running_hack.pid);
	if (running_grow) ns.kill(running_grow.pid);
	if (running_weak) ns.kill(running_weak.pid);

	ns.tprint("Starting...");
	await start(ns, opts, hack_threads, grow_threads, weak_threads);
}

/** 
 * @typedef {object} HackGoal
 * @property {number} amount
 * @property {number} factor
 * 
 * @param {NS} ns
 * @param {string} target
 * @param {number} factor
 * 
 * @return {HackGoal}
 */
export function calc_hack_goal(ns, target, factor) {
	const max = ns.getServerMaxMoney(target);
	const goal = Math.max(max / factor, 100_000);

	return {
		amount: goal,
		factor: 2,
		//factor: 1 + goal / (max - goal),
	};
}

/** 
 * @param {NS} ns
 * @param {string} target
 * @param {number} goal
 * 
 * @return {number}
 */
export function calc_hack_threads(ns, target, goal) {
	const threads = ns.hackAnalyzeThreads(target, goal);
	return Math.max(Math.floor(threads), 1);
}

/** 
 * @param {NS} ns
 * @param {string} target
 * @param {Server} host
 * @param {number} factor
 * 
 * @return {number}
 */
export function calc_grow_threads(ns, target, host, factor) {
	const threads = ns.growthAnalyze(target, factor, host.cpuCores);
	return Math.max(Math.ceil(threads), 1);

	//const growth_rate = ns.getServerGrowth(target);
	//const difficulty =  ns.getServerMinSecurityLevel(target) + 5; // add a buffer

	// factor = min(1 + 0.03/difficulty, 1.0035) ^ (threads * (growth_rate / 100))
	// https://github.com/danielyxie/bitburner/blob/dev/src/Server/formulas/grow.ts

	//const base = Math.min(1 + 0.03 / difficulty, 1.0035);
	//const exp = growth_rate / 100;
	//const threads = (Math.log(factor) / Math.log(base)) / exp;
	//return threads < 1 ? 1 : Math.ceil(threads); 
}

/**
 * @param {NS} ns
 * @param {string} target
 * @param {Server} host
 * @param {number} hack_threads
 * @param {number} grow_threads
 * 
 * @return {number}
 */
export function calc_weak_threads(ns, target, host, hack_threads, grow_threads) {
	const hack_sec = ns.hackAnalyzeSecurity(hack_threads, target);
	const grow_sec = ns.growthAnalyzeSecurity(grow_threads, target, host.cpuCores);

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
		affect = ns.weakenAnalyze(threads, host.cpuCores);
	}
	return Math.max(Math.ceil(threads), 1);

	//const sec_diff = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
	//const threads = (sec_diff + hack_threads * 0.003 + grow_threads * 0.005) / 0.05;
	//return threads < 1 ? 1 : Math.ceil(threads); 
}

/**
 * @param {NS} ns
 * @param {object} opts
 * @param {number} hack_threads
 * @param {number} grow_threads
 * @param {number} weak_threads
 */
export async function start(ns, opts, hack_threads, grow_threads, weak_threads) {
	await ns.scp(opts.hack, "home", opts.host);
	await ns.scp(opts.grow, "home", opts.host);
	await ns.scp(opts.weak, "home", opts.host);

	let hack_pid = 0;
	let grow_pid = 0;
	let weak_pid = 0;

	try {
		hack_pid = ns.exec(opts.hack, opts.host, hack_threads > 0 ? hack_threads : 1, opts.target);
		if (hack_pid === 0) throw "failed to start hack script";
	
		grow_pid = ns.exec(opts.grow, opts.host, grow_threads > 0 ? grow_threads : 1, opts.target);
		if (grow_pid === 0) throw "failed to start grow script";
	
		weak_pid = ns.exec(opts.weak, opts.host, weak_threads > 0 ? weak_threads : 1, opts.target);
		if (weak_pid === 0) throw "failed to start weak script";
	} catch (ex) {
		if (hack_pid !== 0) ns.kill(hack_pid);
		if (grow_pid !== 0) ns.kill(grow_pid);
		if (weak_pid !== 0) ns.kill(weak_pid);
		ns.tprint(ex);
	}
}
