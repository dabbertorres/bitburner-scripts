/** @param {NS} ns */
export async function main(ns) {
	if (ns.args.length !== 1) {
		ns.tprint("must provide a single hostname");
		return;
	}

	const target = ns.args[0];

	const server = ns.getServer(target);

	ns.tprintf(`Server: ${target}\n`);
	ns.tprintf(`\tMoney: ${server.moneyAvailable} / ${server.moneyMax}\n`);
	ns.tprintf(`\tSec:   ${server.hackDifficulty} / ${server.minDifficulty}\n`);
	ns.tprintf(`\tCPUs:  ${server.cpuCores}\n`);
	ns.tprintf(`\tRAM:   ${server.ramUsed} / ${server.maxRam}\n`);
	ns.tprintf(`\tGrow:  ${server.serverGrowth}\n`);

	ns.tprintf(`\tTo Root:\n`);
	ns.tprintf(`\t\tPorts: ${server.numOpenPortsRequired}\n`);
	ns.tprintf(`\t\tLevel: ${server.requiredHackingSkill}\n`);

	ns.tprintf(`\tTo Hack:\n`);
	ns.tprintf(`\t\tHack Time: ${ns.tFormat(ns.getHackTime(target))}\n`);
	ns.tprintf(`\t\tGrow Time: ${ns.tFormat(ns.getGrowTime(target))}\n`);
	ns.tprintf(`\t\tWeak Time: ${ns.tFormat(ns.getWeakenTime(target))}\n`);
}

export function autocomplete(data, args) {
	return [...data.servers];
}