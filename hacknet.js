import * as util from "util.js";

/**
 * @typedef {object} Opts
 * @property {number} port
 * @property {number} period
 * @property {boolean} upgrade
 * @property {boolean} buy
 * @property {number} money_limit
 * @property {number} keep
 */
const flags = [
	["port", 17, "Netscript Port to listen for control messages on."],
	["period", 200, "Period (in milliseconds) between updates."],
	["upgrade", true, "Enable purchasing upgrades of servers."],
	["buy", true, "Enable purchasing new servers."],
	["money_limit", 0, "Amount of money to leave in player's wallet."],
	["keep", 4, "Start selling hashes when available capacity is less than this value."],
];

export const autocomplete = util.autocompleter(flags);

/**
 * @typedef {object} ControlMessage
 * @property {number?} period
 * @property {boolean?} upgrade
 * @property {boolean?} buy
 * @property {number?} money_limit
 * @property {number?} keep
 */

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	/** @type {Opts} */
	const opts = ns.flags(flags);

	const handle = ns.getPortHandle(opts.port);

	while (true) {
		const data = handle.read();
		if (data !== "NULL PORT DATA") {
			/** @type {ControlMessage} */
			const msg = JSON.parse(data);

			if (msg.period !== undefined && msg.period !== null) opts.period = msg.period;
			if (msg.upgrade !== undefined && msg.upgrade !== null) opts.upgrade = msg.upgrade;
			if (msg.buy !== undefined && msg.buy !== null) opts.buy = msg.buy;
			if (msg.money_limit !== undefined && msg.money_limit !== null) opts.money_limit = msg.money_limit;
			if (msg.keep !== undefined && msg.keep !== null) opts.keep = msg.keep;
		}

		/** @type {Upgrade} */
		let purchase = {
			cost: Number.MAX_SAFE_INTEGER,
			gain: 0,
			desc: null,
			action: null,
		};
		if (opts.buy) {
			if (ns.hacknet.numNodes() < ns.hacknet.maxNumNodes()) {
				purchase.cost = ns.hacknet.getPurchaseNodeCost();
				purchase.gain = 0.001 / purchase.cost;
				purchase.desc = "purchase new node";
				purchase.action = ns.hacknet.purchaseNode;
			}
		}

		if (opts.upgrade) {
			let comparison = (next, prev) => next.cost < prev.cost;
			if (ns.fileExists("Formulas.exe", "home")) {
				comparison = (next, prev) => next.gain > prev.gain;
			}

			for (let i = 0; i < ns.hacknet.numNodes(); i++) {
				const upgrades = node_upgrade_costs(ns, i);

				if (Number.isFinite(upgrades.level.cost)) {
					if (comparison(upgrades.level, purchase)) {
						purchase = upgrades.level;
					}
				}

				if (Number.isFinite(upgrades.ram.cost)) {
					if (comparison(upgrades.ram, purchase)) {
						purchase = upgrades.ram;
					}
				}

				if (Number.isFinite(upgrades.core.cost)) {
					if (comparison(upgrades.core, purchase)) {
						purchase = upgrades.core;
					}
				}
			}
		}

		const available = ns.hacknet.numHashes();
		let sale_count = Math.floor((available - opts.keep) / 4);

		for (; sale_count > 0; sale_count--) {
			ns.hacknet.spendHashes("Sell for Money");
		}

		const current_money = ns.getServerMoneyAvailable("home");
		const money_left = current_money - purchase.cost;

		if (purchase.action !== null && money_left >= opts.money_limit) {
			purchase.action();
		}

		await ns.sleep(opts.period);
	}
}

/**
 * @typedef {object} Upgrade
 * @property {number} cost
 * @property {number} gain
 * @property {string} desc
 * @property {object} action
 */

/**
 * @typedef {object} NodeUpgrades
 * @property {Upgrade} level
 * @property {Upgrade} ram
 * @property {Upgrade} core
 */

/** 
 * @param {NS} ns
 * @param {number} i
 * 
 * @return {NodeUpgrades}
 */
function node_upgrade_costs(ns, i) {
	/** @type {NodeUpgrades} */
	const upgrades = {
		level: {
			cost: ns.hacknet.getLevelUpgradeCost(i, 1),
			gain: 0,
			desc: ns.sprintf("upgrade level of server #%d", i),
			action: () => ns.hacknet.upgradeLevel(i, 1),
		},
		ram: {
			cost: ns.hacknet.getRamUpgradeCost(i, 1),
			gain: 0,
			desc: ns.sprintf("upgrade ram of server #%d", i),
			action: () => ns.hacknet.upgradeRam(i, 1),
		},
		core: {
			cost: ns.hacknet.getCoreUpgradeCost(i, 1),
			gain: 0,
			desc: ns.sprintf("upgrade cores of server #%d", i),
			action: () => ns.hacknet.upgradeCore(i, 1),
		},
	};

	if (ns.fileExists("Formulas.exe", "home")) {
		const stats = ns.hacknet.getNodeStats(i);

		upgrades.level.gain = (ns.formulas.hacknetServers.hashGainRate(stats.level + 1, stats.ramUsed, stats.ram, stats.cores)
			- ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed, stats.ram, stats.cores))
			/ upgrades.level.cost;

		upgrades.ram.gain = (ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed, stats.ram * 2, stats.cores)
			- ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed, stats.ram, stats.cores))
			/ upgrades.ram.cost;

		upgrades.core.gain = (ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed, stats.ram, stats.cores + 1)
			- ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed, stats.ram, stats.cores))
			/ upgrades.core.cost;
	}

	return upgrades;
}