import * as util from "util.js";

const flags = [
	["max", false, "Print the max amount of RAM a bought server can have."],
	["check", false, "Just check the cost of a server with --size, instead of buying it."],
	["size", 0, "Amount of RAM in GiB for new server."],
	["host", "", "Name to give to new server. Defaults to 'server-#', where # is the number of purchased servers."],
	["sell", false, "Sell the last purchased server, or the one named by --host."],
	["help", false, "Print the help."],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
	const total = ns.getPurchasedServers().length;
	const limit = ns.getPurchasedServerLimit();
	const max_ram = ns.getPurchasedServerMaxRam();

	const opts = ns.flags(flags);

	if (opts.help) {
		util.help(ns, flags, "buy_server.js: Buy a custom server.");
		return;
	}

	if (opts.max) {
		ns.tprintf("Max RAM: %d GiB", max_ram);
		return;
	}

	if (opts.host === "") {
		if (opts.sell) {
			// default to last
			opts.host = "server-" + (total - 1).toString();
		} else {
			// find the next available 'server-#' (there could be gaps, since servers can be sold)
			const servers = ns.getPurchasedServers();
	
			// <= so we automatically go to the next available if there are no gaps
			for (let i = 0; i <= total; ++i) {
				const name = "server-" + i.toString();
				if (!servers.includes(name)) {
					opts.host = name;
					break;
				}
			}
		}
	}

	if (opts.sell) {
		if (ns.deleteServer(opts.host)) {
			ns.tprintf("Deleted server %s", opts.host);
		} else {
			ns.tprintf("Failed to delete server %s", opts.host);
		}
		return;
	}

	const exp = Math.log2(opts.size);
	if (Math.floor(exp) !== exp) {
		ns.tprint("RAM must be a power of 2.");
		return;
	}

	if (total >= limit) {
		ns.tprintf("Server limit (%d) reached!", limit);
		return;
	}

	const have = ns.getServerMoneyAvailable("home");
	let cost = 0;

	if (opts.size === 0) {
		// calculate the largest server that we can buy NOW
		let ram = 1;
		while (ram < max_ram) {
			let new_ram = ram << 1;
			let new_cost = ns.getPurchasedServerCost(new_ram);
			if (new_cost > have) {
				break;
			}

			ram = new_ram;
			cost = new_cost;
		}

		opts.size = ram;
	} else {
		cost = ns.getPurchasedServerCost(opts.size);
	}

	if (opts.check) {
		const available = have >= cost && total < limit;
		const cost_str = ns.nFormat(cost, "($ 0.00 a)");

		ns.tprintf("%d GiB: available: %s for %s", opts.size, available, cost_str);
		return;
	}

	if (cost > have) {
		ns.tprintf("Not enough money. Need %s, but have %s.",
			ns.nFormat(cost, "($ 0.00 a)"),
			ns.nFormat(have, "($ 0.00 a)"));
	} else {
		const name = ns.purchaseServer(opts.host, opts.size);
		ns.tprintf("Server with %d GiB now available as '%s'", opts.size, name);
	}
}