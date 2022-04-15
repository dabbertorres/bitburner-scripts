/** @param {NS} ns */
export async function main(ns) {
	const total = ns.getPurchasedServers().length;
	const limit = ns.getPurchasedServerLimit()

	const data = ns.flags([
		["max", false],
		["check", false],
		["buy", false],
		["size", 0],
		["host", "server-" + total],
	]);

	if (data.max) {
		ns.tprintf("Max RAM: %dGiB", ns.getPurchasedServerMaxRam() / 1024);
		return;
	}


	const exp = Math.log2(data.size);
	if (Math.floor(exp) !== exp) {
		ns.tprint("RAM must be a power of 2.");
		return;
	}

	const ram = Math.pow(2, exp);

	if (data.check) {
		const have = ns.getServerMoneyAvailable("home");
		const cost = ns.getPurchasedServerCost(ram);
		if (have >= cost && total < limit) {
			ns.tprint("Available!")
		} else {
			ns.tprint("Unavailable!")
		}
		print_price(ns, cost);
		return;
	}

	if (data.buy) {
		const have = ns.getServerMoneyAvailable("home");
		const cost = ns.getPurchasedServerCost(ram);
		if (cost > have) {
			ns.tprint("Not enough money!")
		} else if (total >= limit) {
			ns.tprint("Server limit reached!")
		} else {
			const name = ns.purchaseServer(data.host, ram);
			ns.tprintf("Server now available as '%s'", name);
		}
		return;
	}

	ns.tprint("must specify an option: --max, --check, --buy")
}

/** @param {NS} ns */
function print_price(ns, cost) {
	if (cost < 1000) {
		ns.tprintf("$%f", cost);
	} else if (cost < 1000000) {
		ns.tprintf("$%fk", cost / 1000);
	} else if (cost < 1000000000) {
		ns.tprintf("$%fm", cost / 1000000);
	} else if (cost < 1000000000000) {
		ns.tprintf("$%fb", cost / 1000000000);
	}
}