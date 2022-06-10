import * as path from "path_find.js";

export const autocomplete = path.autocomplete;

/** @param {NS} ns */
export async function main(ns) {
    if (!has_singularity(ns)) {
        ns.tprint("Source File 4 (Singularity) is required.");
        return;
    }
	
	if (ns.args.length !== 1) {
        ns.tprint("must provide a single target server name.");
        return;
	}
    
    if (ns.args.length !== 1) {
        ns.tprint("must provide a single target server name.");
        return;
    }

    const target = ns.args[0];
    const source = ns.getHostname();
    const chain = path.find(ns, target, source, [], []);

    if (!chain) {
        ns.tprintf("Couldn't find %s.", target);
        return;
    }

	chain.forEach(s => ns.singularity.connect(s));
    await ns.singularity.installBackdoor();

    path.find(ns, source, target, [], [])
        .forEach(s => ns.singularity.connect(s));
}

/** @param {NS} ns */
function has_singularity(ns) {
    return ns.getOwnedSourceFiles().some(sf => sf.n === 4) || ns.getPlayer().bitNodeN === 4;
}