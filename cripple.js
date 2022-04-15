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
	ns.tprintf("Will cripple %s in %s (%d threads).", data.target, time_string(ns, total_time), threads);

	if (data.dry) return;

	await ns.scp(data.script, "home", host.hostname);

	if (host.hostname !== self.server) {
		ns.exec(data.script, host.hostname, threads, data.target, min);
	} else {
		// reclaim the ram we were using for the "do script"
		ns.spawn(data.script, threads, data.target, min);
	}
}

/** @param {NS} ns */
export function time_string(ns, ms) {
	if (ms < 1000)
		return ms.toFixed(2);

	let seconds = Math.floor(ms / 1000);
	ms %= 1000;

	if (seconds < 60)
		return ns.sprintf("%ds%.2fms", seconds, ms);

	let minutes = Math.floor(seconds / 60);
	seconds %= 60;

	if (minutes < 60)
		return ns.sprintf("%dm%ds%.2fms", minutes, seconds, ms);

	let hours = Math.floor(minutes / 60);
	minutes %= 60;

	if (hours < 60)
		return ns.sprintf("%dh%dm%ds%.2fms", hours, minutes, seconds, ms);

	let days = Math.floor(hours / 24);
	hours %= 24;

	return ns.sprintf("%dd%dh%dm%ds%.2fms", days, hours, minutes, seconds, ms);
}