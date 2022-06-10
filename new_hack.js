/** @param {NS} ns */
export async function main(ns) {
	if (ns.args.length !== 1) {
		ns.tprint("must provide a single hostname");
		return;
	}

	const target = ns.args[0];

	const data = JSON.stringify({
		type: "new_hack",
		 data: {target: target},
	});

	let success = false;
	do {
		success = await ns.tryWritePort(20, data);
		if (!success) {
			ns.tprint(`Orchestrator queue full - waiting...`);
			await ns.sleep(5_000);
		}
	} while (!success);

	ns.tprint(`${target} Queued!`);
}

export function autocomplete(data, args) {
	return [...data.servers];
}