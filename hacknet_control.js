import * as util from "util.js";

/**
 * @typedef {object} Opts
 * @property {number} port
 * @property {number} period
 * @property {boolean} upgrade
 * @property {boolean} noupgrade
 * @property {boolean} buy
 * @property {boolean} nobuy
 * @property {number} money_limit
 * @property {number} keep
 */

const flags = [
	["port", 17, "Netscript Port to listen for control messages on."],
	["period", -1, "Period (in milliseconds) between updates."],
	["upgrade", false, "Enable purchasing upgrades of servers."],
	["noupgrade", false, "Disable purchasing upgrades of servers."],
	["buy", false, "Enable purchasing new servers."],
	["nobuy", false, "Disable purchasing new servers."],
	["money_limit", -1, "Amount of money to leave in player's wallet."],
	["keep", -1, "Number of hashes to keep available."],
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
    /** @type {Opts} */
    const opts = ns.flags(flags);

	const handle = ns.getPortHandle(opts.port);

	/** @type {ControlMessage} */
    const message = {};

	if (opts.period !== -1) {
		message.period = opts.period;
	}

	if (opts.upgrade) {
		message.upgrade = true;
	} else if (opts.noupgrade) {
		message.upgrade = false;
	}

	if (opts.buy) {
		message.buy = true;
	} else if (opts.nobuy) {
		message.buy = false;
	}

	if (opts.money_limit !== -1) {
		message.money_limit = opts.money_limit;
	}

	if (opts.keep !== -1) {
		message.keep = opts.keep;
	}

	const data = JSON.stringify(message);

	const result = handle.tryWrite(data);
	if (!result) {
		ns.tprintf("failed to write to port %d - queue is full (is there a hacknet.js script on the other side?).", opts.port);
	} else {
		ns.tprint("done.");
	}
}