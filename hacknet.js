/** @param {NS} ns */
export async function main(ns) {
	const max_level = 200;
	const max_ram_upgrades = 6;
	const max_cpu_upgrades = 16;

	while (ns.hacknet.numNodes() === 0) {
		ns.hacknet.purchaseNode();
		await ns.sleep(5000);
	}

	while (true) {
		const mults = getHacknetMultipliers();
		const current_money = ns.getServerMoneyAvailable("home");

		for (let i = 0; i < ns.hacknet.numNodes(); i++) {
			const stats = ns.hacknet.getNodeStats(i);
		}

		await ns.sleep(1000);
	}
}