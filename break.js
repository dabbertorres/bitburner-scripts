/*export function autocomplete(data, args) {
	if (args.length === 0) {
		return [...data.flags()];
	}

	const last = args[args.length - 1];
	switch (last) {
	case "--hack":
		return [...data.scripts];

	case "--target":
		return [...data.servers];

	default:
		return [];
	}
}*/

/**
* @param {NS} ns
**/
export async function main(ns) {
	ns.disableLog("ALL");
	ns.enableLog("exec");

	const data = ns.flags([
		["hack", "basic_hack.js"],
		["target", ns.getHostname()],
	]);

	await break_target(ns, data.hack, data.target);
}

/**
* @param {NS} ns
**/
export async function break_target(ns, script, ...target_chain) {
	const target = target_chain[target_chain.length - 1];
	if (target !== "home") {
		const success = await get_access(ns, target);
		if (success) {
			await run_hack_script(ns, script, target);
		}
	}

	const neighbors = get_neighbors(ns, ...target_chain);
	await spread(ns, script, target_chain, neighbors);
}

/**
* @param {NS} ns
**/
export async function get_access(ns, target) {
	if (ns.hasRootAccess(target)) {
		//ns.printf("already have root access on %s", target);
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
	ns.tprintf("now have access to %s!", target);
	return true;
}

/**
* @param {NS} ns
**/
export async function run_hack_script(ns, script, target) {
	if (ns.scriptRunning(script, target)) {
		//ns.printf("already running %s on %s", script, target);
		return;
	}

	if (ns.getServerMaxMoney(target) === 0) {
		ns.printf("ignoring %s - max money is $0", target);
		return;
	}

	const serverRAM = ns.getServerMaxRam(target);
	const scriptRAM = ns.getScriptRam(script, "home")
	if (serverRAM < scriptRAM) {
		ns.printf("ignoring %s - too little RAM (%f < %f)", target, serverRAM, scriptRAM);
		return;
	}

	await ns.scp(script, "home", target);

	const free = ns.getServerMaxRam(target) - ns.getServerUsedRam(target);
	const need = ns.getScriptRam(script, target);
	const threads = Math.floor(free / need);

	const money_threshold = ns.getServerMaxMoney(target) * 0.75;
	const sec_threshold =  ns.getServerMinSecurityLevel(target) + 5;
	ns.exec(script, target, threads > 0 ? threads : 1, target, money_threshold, sec_threshold);

	ns.tprintf("now hacking %s!", target);
}

/**
* @param {NS} ns
**/
export async function spread(ns, script, target_chain, neighbors) {
	for (let neighbor of neighbors) {
		await break_target(ns, script, ...target_chain, neighbor);
	}
}

/**
* @param {NS} ns
**/
export function get_neighbors(ns, ...target_chain) {
	const ignore_list = [
		"home",
		"server-0",
		"server-1",
		"server-2",
		"server-3",
		"server-4",
		"server-5",
		"server-6",
		"server-7",
		"server-8",
		"server-9",
	];

	const target = target_chain[target_chain.length - 1];
	let parent = null;
	if (target_chain.length > 1) {
		parent = target_chain[target_chain.length - 2];
	}
	return ns.scan(target).filter(neighbor => !ignore_list.includes(neighbor) && neighbor !== parent);
}