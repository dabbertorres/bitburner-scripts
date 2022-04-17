import * as util from "util.js";

/**
 * @typedef {object} Opts
 * @property {number} investment
 * @property {number} port
 * @property {string} state_file
 * @property {boolean} wallet
 */

const flags = [
	["investment", 1_000_000, "The initial amount of money to set aside for stocks."],
	["min_sell", 10_000, "Don't consider selling until the profit would be this much."],
	["port", 17, "Port for communication. Only scripts using the same port can communicate."],
	["state_file", "stock_market_bot_state.json", "Name of file to use for persisting state."],
	["wallet", false, "Get the state of the bot's wallet."],
	//["add", 0, "Add funds to the bot's wallet."],
];

export const autocomplete = util.autocompleter(flags);

/**
 * @typedef {object} Wallet
 * @property {number} investment
 * @property {number} current
 * @property {number} min_sell
 */

/** @param {NS} ns */
export async function main(ns) {
	const opts = ns.flags(flags);

	const data_port = ns.getPortHandle(opts.port);

	if (opts.wallet) {
		const wallet = get_state(data_port, 2000);
		if (wallet) {
			ns.tprintf("Wallet:\n");
			ns.tprintf("\tInvested: $%s\n", (wallet.investment - 0).toFixed(2));
			ns.tprintf("\tCurrent:  $%s\n", (wallet.current - 0).toFixed(2));
			ns.tprintf("\tProfit:   $%s\n", (wallet.current - wallet.investment).toFixed(2));
			return;
		}
	}

	let wallet = restore_state(ns, opts);

	const symbols = ns.stock.getSymbols();

	while (true) {
		market_tick(ns, wallet, symbols);
	
		await save_state(ns, opts, data_port, wallet);
		await ns.sleep(3000);
	}
}

/**
 * @param {NS} ns
 * @param {Wallet} wallet
 * @param {string[]} symbols
 */
function market_tick(ns, wallet, symbols) {
	const orders = symbols.map(sym => ({
		sym: sym,
		proposal: consider_symbol(ns, wallet, sym, 0.48, 0.52, 0.3, 500_000),
	})).filter(order => order.proposal !== null && order.proposal.shares !== 0)
		// flipped for descending order
		.sort((left, right) => Math.abs(right.proposal.confidence) - Math.abs(left.proposal.confidence));

	let liquid_funds = wallet.current;
	let total_cost = 0;
	let total_gain = 0;

	let selected_orders = [];

	for (let ord of orders) {
		let next_total_cost = total_cost;
		let next_total_gain = total_gain;
		if (ord.proposal.confidence > 0) {
			const cost = ns.stock.getPurchaseCost(ord.sym, ord.proposal.shares, "Long");
			next_total_cost += cost;
		} else {
			const gain = ns.stock.getSaleGain(ord.sym, ord.proposal.shares, "Long");
			next_total_gain += gain;
		}

		if (next_total_cost - next_total_gain > liquid_funds) {
			// reached our limit
			break;
		}

		// alright, let's do it!
		total_cost = next_total_cost;
		total_gain = next_total_gain;

		selected_orders.push(ord);
	}

	// do it
	for (let ord of selected_orders) {
		if (ord.proposal.confidence > 0) {
			const cost_per_share = ns.stock.buy(ord.sym, ord.proposal.shares);
			liquid_funds -= ord.proposal.shares * cost_per_share;
		} else {
			const gain_per_share = ns.stock.sell(ord.sym, ord.proposal.shares);
			liquid_funds += ord.proposal.shares * gain_per_share;
		}
	}

	wallet.current = liquid_funds;
}

/**
 * @typedef {object} ProposedOrder
 * @property {number} shares     number of shares to consider
 * @property {number} confidence -1..1 confidence in selling..buying
 * 
 * @param {NS} ns
 * @param {Wallet} wallet             wallet state
 * @param {string} sym                trading symbol
 * @param {number} confidence_min     the point to say a price decrease is "likely"
 * @param {number} confidence_max     the point to say a price increase is "likely"
 * @param {number} max_buy_volatility don't buy new stocks with a volatility above this
 * @param {number} max_spend          maximum amount of money to spend on a buy
 * 
 * @return {ProposedOrder} 
 */
function consider_symbol(ns, wallet, sym, confidence_min, confidence_max, max_buy_volatility, max_spend) {
	const [shares, avg] = ns.stock.getPosition(sym);
	// ignore short for now

	const price = ns.stock.getPrice(sym);
	const volatility = ns.stock.getVolatility(sym);
	const forecast = ns.stock.getForecast(sym);

	const max_change = price * volatility;

	const likely_decrease = forecast < confidence_min;
	const likely_increase = forecast > confidence_max;

	if (shares > 0) {
		// own some - buy, sell, or hold?

		if (likely_increase) {
			// going up: buy more, or hold?

			// make sure we actually can buy more
			if (shares >= ns.stock.getMaxShares(sym)) {
				ns.printf("can't buy more of %s", sym);
				return null;
			}

			// if it's too volatile, don't buy more
			if (volatility > max_buy_volatility) {
				ns.printf("%s is too volatile to buy MORE (%f > %f)", sym, volatility, max_buy_volatility);
				return null;
			}

			// TODO when to buy more?
			ns.printf("didn't make a own/increase decision for %s", sym);
			return null;
		}

		if (likely_decrease) {
			// going down: sell, or hold?

			// if we sell now, can we make a decent profit?
			const gain = ns.stock.getSaleGain(sym, shares, "Long");
			if (gain >= wallet.min_sell) {
				// yes we can; sell!
				const confidence = (0.5 - forecast) / -0.5;
				ns.printf("selling %d of %s; confidence: %f", shares, sym, confidence);
				return {
					shares: shares,
					confidence: confidence,
				};
			}
		}

		// forecast uncertain, hold
		ns.printf("forecast for %s uncertain", sym);
		return null;
	}

	// no shares - buy or hold?

	if (likely_decrease) {
		ns.printf("ignoring decreasing stock %s", sym);
		// dropping - hold
		return null;
	}

	if (likely_increase) {
		// on its way up...

		// but if it's too volatile, not interested
		if (volatility > max_buy_volatility) {
			ns.printf("%s is too volatile to buy (%f > %f)", sym, volatility, max_buy_volatility);
			return null;
		}

		// change is decent though, so we're interested
		if (max_change >= wallet.min_sell) {
			let amount = 0;
			let cost = 0;
			do {
				++amount;
				cost = ns.stock.getPurchaseCost(sym, amount, "Long");
			} while (cost < max_spend);

			const confidence = (forecast - 0.5) / 0.5;
			ns.printf("buying %d of %s; confidence: %f", amount, sym, confidence);

			return {
				shares: amount,
				confidence: confidence,
			};
		}
	}

	// couldn't make a decision
	ns.printf("couldn't make a decision for %s", sym);
	return null;
}

/** 
 * @param {NS} ns
 * @param {NetscriptPort} port
 * @param {number} timeout
 * 
 * @return {Wallet?}
 */
async function get_state(ns, port, timeout) {
	let time_waiting = 0;
	while (time_waiting < timeout) {
		const buf = port.peek();
		if (buf !== "NULL PORT DATA") {
			return JSON.parse(buf);
		}

		await ns.sleep(100);
		time_waiting += 100;
	}

	return null;
}

/**
 * @param {NS} ns
 * @param {Opts} opts
 * 
 * @return {Wallet}
 */
function restore_state(ns, opts) {
	const buf = ns.read(opts.state_file);
	if (buf === "") {
		return {
			investment: opts.investment,
			current: opts.investment,
			min_sell: opts.min_sell,
		}
	}

	return JSON.parse(buf);
}

/**
 * @param {NS} ns
 * @param {Opts} opts
 * @param {NetscriptPort} port
 * @param {Wallet} wallet
 */
async function save_state(ns, opts, port, wallet) {
	const buf = JSON.stringify(wallet);
	port.clear();
	port.write(buf);
	await ns.write(opts.state_file, buf, "w");
}