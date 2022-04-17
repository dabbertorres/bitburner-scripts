import * as util from "util.js";

const flags = [
	["max", false, "Print the max amount of RAM a bought server can have."],
	["check", false, "Just check the cost of a server with --size, instead of buying it."],
	["size", 0, "Amount of RAM in GiB for new server."],
	["host", "", "Name to give to new server. Defaults to 'server-#', where # is the number of purchased servers."],
	["help", false, "Print the help."],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
	const total = ns.getPurchasedServers().length;
	const limit = ns.getPurchasedServerLimit();

	const opts = ns.flags(flags);

	if (opts.help) {
		util.help(ns, flags, "buy_server.js: Buy a custom server.");
		return;
	}

	if (opts.max) {
		ns.tprintf("Max RAM: %dGiB", ns.getPurchasedServerMaxRam() / 1024);
		return;
	}

	if (opts.host === "") {
		opts.host = "server-" + total;
	}

	const exp = Math.log2(opts.size);
	if (Math.floor(exp) !== exp) {
		ns.tprint("RAM must be a power of 2.");
		return;
	}

	const ram = Math.pow(2, exp);

	if (opts.check) {
		const have = ns.getServerMoneyAvailable("home");
		const cost = ns.getPurchasedServerCost(ram);
		if (have >= cost && total < limit) {
			ns.tprint("Available!")
		} else {
			ns.tprint("Unavailable!")
		}
		ns.tprint(ns.nFormat(cost, "($ 0.00 a)"));
		return;
	}

	const have = ns.getServerMoneyAvailable("home");
	const cost = ns.getPurchasedServerCost(ram);
	if (cost > have) {
		ns.tprintf("Not enough money. Need %s, but have %s.",
			ns.nFormat(cost, "($ 0.00 a)"),
			ns.nFormat(have, "( $0.00 a)"));
	} else if (total >= limit) {
		ns.tprint("Server limit reached!")
	} else {
		const name = ns.purchaseServer(opts.host, ram);
		ns.tprintf("Server now available as '%s'", name);
	}
}
