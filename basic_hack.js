/** @param {NS} ns */
export async function main(ns) {
	const target = ns.args[0];
	const moneyThreshold = ns.args[1];
	const securityThreshold = ns.args[2];

	while (true) {
		let complete = null;
		if (ns.getServerSecurityLevel(target) > securityThreshold) {
			complete = ns.weaken(target);
		} else if (ns.getServerMoneyAvailable(target) < moneyThreshold) {
			complete = ns.grow(target);
		} else {
			complete = ns.hack(target);
		}

		await complete;
	}
}