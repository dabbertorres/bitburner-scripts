/** @param {NS} ns */
export async function main(ns) {
	const data = ns.flags([
		["target", ""],
		["host", ns.getHostname()],
		["threads", 0],
		["script", "do_cripple.js"],
		["dry", false],
	]);

	if (data.target == "") {
		ns.tprint("must specify a single server");
		return;
	}

	if (!ns.serverExists(data.target)) {
		ns.tprintf("No such server '%s'", data.target);
		return;
	}

	const self = ns.getRunningScript();
	const host = ns.getServer(data.host);

	let threads = data.threads;
	if (threads === 0) {
		let available = host.maxRam - host.ramUsed;
		if (host.hostname === self.server) {
			// we can reclaim the ram we are using for the "do script"
			available += self.ramUsage;
		}

		const per_thread = ns.getScriptRam(data.script, self.server);

		threads = Math.floor(available / per_thread);
	}

	const min = ns.getServerMinSecurityLevel(data.target);
	const amount = ns.getServerSecurityLevel(data.target) - min;

	const time_per_call = ns.getWeakenTime(data.target);
	const affect = ns.weakenAnalyze(threads, host.cpuCores);

	const calls = amount / affect;
	const total_time = calls * time_per_call;
	ns.tprintf("Will cripple %s in %s (%d threads).", data.target, ns.tFormat(total_time), threads);

	if (data.dry) return;

	await ns.scp(data.script, "home", host.hostname);

	if (host.hostname !== self.server) {
		ns.exec(data.script, host.hostname, threads, data.target, min);
	} else {
		// reclaim the ram we were using for the "do script"
		ns.spawn(data.script, threads, data.target, min);
	}
}