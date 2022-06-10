/** @param {NS} ns */
export async function main(ns) {
	const programs = [
		 "BruteSSH.exe",
		 "FTPCrack.exe",
		 "relaySMTP.exe",
		 "HTTPWorm.exe",
		 "SQLInject.exe",
	];

	ns.singularity.purchaseTor();

	for (let p of programs) {
		while (!ns.fileExists(p)) {
			ns.singularity.purchaseProgram(p);
			await ns.sleep(5000);
		}
	}
}