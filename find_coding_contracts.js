import { find } from "find.js";

/** @param {NS} ns */
export async function main(ns) {
	const filter = server => {
		const contracts = ns.ls(server, ".cct");
		return contracts?.length !== 0;
	};

	const results = find(ns, "home", [], [], filter);

	if (results.length !== 0) {
		ns.tprintf("found contracts on the following servers: %s", results.join("\n"));
	} else {
		ns.tprint("no coding contracts found");
	}
}