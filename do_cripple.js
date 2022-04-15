/** @param {NS} ns */
export async function main(ns) {
	const target = ns.args[0];
	const min = ns.args[1];

	while (ns.getServerSecurityLevel(target) > min) {
		await ns.weaken(target);
	}
}