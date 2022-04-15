/** @param {NS} ns */
export async function main(ns) {
	const target = ns.args[0];

	ns.tprintf("Server %s:\n", target);
	ns.tprintf("\tMoney: %f / %f\n", ns.getServerMoneyAvailable(target), ns.getServerMaxMoney(target));
	ns.tprintf("\tSec:   %f / %f\n", ns.getServerSecurityLevel(target), ns.getServerMinSecurityLevel(target));
	ns.tprintf("\tRAM:   %f / %f\n", ns.getServerUsedRam(target), ns.getServerMaxRam(target));
	ns.tprintf("\tGrow:  %f\n", ns.getServerGrowth(target));
	ns.tprintf("\tTo Hack:\n");
	ns.tprintf("\t\tPorts: %f\n", ns.getServerNumPortsRequired(target));
	ns.tprintf("\t\tLevel: %f\n", ns.getServerRequiredHackingLevel(target));
}

export function autocomplete(data, args) {
	return [...data.servers];
}