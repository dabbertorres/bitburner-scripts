import * as util from "util.js";

const flags = [
	["hack", "basic_hack.js", "The script to run on new servers. Set to empty to not use.", data => [...data.scripts]],
	["daemon", false, "Run script as a daemon, checking for new servers every --frequency seconds."],
	["frequency", 5 * 1000, "Only relevant when --daemon is set. Number of seconds for how often new servers are checked for."],
	["help", false, "Print the help."],
];

export const autocomplete = util.autocompleter(flags);

/**
 * @param {NS} ns
 **/
export async function main(ns) {
	ns.disableLog("ALL");
	ns.enableLog("exec");

	const data = ns.flags(flags);

	if (data.help) {
		util.help(ns, flags, "break.js: gain root access to all possible servers.");
		return;
	}

	if (!data.daemon) {
		flags.frequency = 1;
	}

	const ignore_list = new Array(ns.getPurchasedServerLimit())
		.fill(0)
		.map((_, i) => "server-" + i)
		.concat(["home"]);

	do {
		await break_target(ns, data.hack, ignore_list, "home");
		await ns.asleep(data.frequency);
	} while (data.daemon);
}

/**
 * @param {NS} ns
 * @param {string} script
 * @param {string[]} ignore_list
 * @param {string[]} target_chain
 **/
export async function break_target(ns, script, ignore_list, ...target_chain) {
	const target = target_chain[target_chain.length - 1];
	if (!ignore_list.includes(target)) {
		const success = await get_access(ns, target);
		if (success && script !== "") {
			await run_hack_script(ns, script, target);
		}
	}

	const neighbors = get_neighbors(ns, ignore_list, ...target_chain);
	await spread(ns, script, ignore_list, target_chain, neighbors);
}

/**
 * @param {NS} ns
 * @param {string} target
 **/
export async function get_access(ns, target) {
	if (ns.hasRootAccess(target)) {
		return true;
	}

	const level_have = ns.getHackingLevel();
	const level_need = ns.getServerRequiredHackingLevel(target);
	if (level_have < level_need) {
		ns.printf("can't nuke %s yet (level) - skipping", target);
		return false;
	}

	const tools = [
		{ name: "BruteSSH.exe", func: ns.brutessh },
		{ name: "FTPCrack.exe", func: ns.ftpcrack },
		{ name: "relaySMTP.exe", func: ns.relaysmtp },
		{ name: "HTTPWorm.exe", func: ns.httpworm },
		{ name: "SQLInject.exe", func: ns.sqlinject },
	];

	let total_tools = 0;
	for (let t of tools) {
		if (ns.fileExists(t.name, "home")) {
			total_tools++;
		}
	}

	const ports_required = ns.getServerNumPortsRequired(target);
	if (ports_required > total_tools) {
		ns.printf("can't nuke %s yet (ports) - skipping", target);
		return false;
	}

	//ns.printf("starting port opening on %s", target);
	for (let i = 0; i < ports_required; i++) {
		const tool = tools[i];
		if (ns.fileExists(tool.name, "home")) {
			tool.func(target);
		}
	}

	// just for fun - copy any files on the host
	const serverFiles = ns.ls(target)
		.filter(name => name.endsWith(".lit") || name.endsWith(".txt"));
	if (serverFiles.length != 0) {
		await ns.scp(serverFiles, target, "home");
	}

	ns.nuke(target);
	const msg = ns.sprintf("now have access to %s!", target);
	ns.toast(msg, "info");

	if (util.has_singularity(ns)) {
		ns.run("backdoor.js", 1, target);
	}

	return true;
}

/**
 * @param {NS} ns
 * @param {string} script
 * @param {string} target
 **/
export async function run_hack_script(ns, script, target) {
	if (ns.scriptRunning(script, target)) {
		return;
	}

	if (ns.getServerMaxMoney(target) === 0) {
		ns.printf("ignoring %s - max money is $0", target);
		return;
	}

	await ns.scp(script, "home", target);

	const serverRAM = ns.getServerMaxRam(target);
	const scriptRAM = ns.getScriptRam(script, target);
	if (serverRAM < scriptRAM) {
		ns.printf("ignoring %s - too little RAM (%f < %f)", target, serverRAM, scriptRAM);
		return;
	}

	const free = ns.getServerMaxRam(target) - ns.getServerUsedRam(target);
	const need = ns.getScriptRam(script, target);
	const threads = Math.floor(free / need);

	const money_threshold = ns.getServerMaxMoney(target);
	const sec_threshold =  ns.getServerMinSecurityLevel(target);

	const pid = ns.exec(script, target, threads > 0 ? threads : 1, target, money_threshold, sec_threshold);
	if (pid > 0) {
		const msg = ns.sprintf("now hacking %s!", target);
		ns.toast(msg, "success");
	} else {
		const msg = ns.sprintf("failed to start hack script on %s...", target);
		ns.toast(msg, "error");
	}
}

/**
 * @param {NS} ns
 * @param {string} script
 * @param {string[]} ignore_list
 * @param {string[]} target_chain
 * @param {string[]} neighbors
 **/
export async function spread(ns, script, ignore_list, target_chain, neighbors) {
	for (let neighbor of neighbors) {
		await break_target(ns, script, ignore_list, ...target_chain, neighbor);
	}
}

/**
 * @param {NS} ns
 * @param {string[]} ignore_list
 * @param {string[]} target_chain
 **/
export function get_neighbors(ns, ignore_list, ...target_chain) {
	const target = target_chain[target_chain.length - 1];
	let parent = null;
	if (target_chain.length > 1) {
		parent = target_chain[target_chain.length - 2];
	}
	return ns.scan(target).filter(neighbor => !ignore_list.includes(neighbor) && neighbor !== parent);
}