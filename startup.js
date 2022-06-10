/** @param {NS} ns */
export async function main(ns) {
	const run_on_start = [
		{ script: "start_sleeves.js", threads: 1, args: [] },
		{ script: "hacknet.js", threads: 1, args: [ "--keep", 0, "--money_limit", 0 ], },
		{ script: "break.js", threads: 1, args: [ "--daemon" ] },
		{ script: "create_programs.js", threads: 1, args: [] },
		{ script: "new_hack.js", threads: 1, args: ["n00dles"] },
	];

	for (let s of run_on_start) {
		const pid = ns.run(s.script, s.threads, ...s.args);
		if (pid === 0) {
			ns.toast("failed to start " + s.script, ns.enums.toast.ERROR);
		}
	}

	ns.spawn("orchestrator.js");
}