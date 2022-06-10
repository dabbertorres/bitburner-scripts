export function autocomplete(data, args) {
	return [...data.servers];
}

/** @param {NS} ns */
export async function main(ns) {
    if (ns.args.length !== 1) {
        ns.tprint("must provide a single target server name.");
        return;
    }

    const target = ns.args[0];
    const source = ns.getHostname();
    const chain = find(ns, target, source, [], [])?.map(s => "connect " + s);

    if (!chain) {
        ns.tprintf("Couldn't find %s.", target);
        return;
    }

    ns.tprint(chain.join("; "));
}

/** 
 * @param {NS} ns
 * @param {string} target
 * @param {string} source
 * @param {string[]} chain
 * @param {string[]} ignore
 * 
 * @return {string[]}
 */
export function find(ns, target, source, chain, ignore) {
    for (let server of ns.scan(source)) {
        if (ignore.includes(server)) continue;

        if (server === target) return [...chain, server];

        const path = find(ns, target, server, [...chain, server], [...ignore, source]);
        if (path) return path;
    }

    return null;
}