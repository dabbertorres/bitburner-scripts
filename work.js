import * as util from "util.js";

const flags = [
	["company", "Universal Energy", "company to work for"],
	["job", "Software", "job to work at the company"],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
    const opts = ns.flags(flags);

	while (true) {
		// wait until we're not busy
		while (ns.singularity.isBusy()) {
			await ns.sleep(1000);
		}

		if (ns.singularity.applyToCompany(opts.company, opts.job)) {
			ns.toast(ns.sprintf("got a promotion in %s for %s!", opts.job, opts.company), "success");
		}

		if (!ns.singularity.workForCompany(opts.company)) {
			ns.toast(ns.sprintf("failed to work for %s doing %s!", opts.company, opts.job), "warning");
			return;
		}

		// work full 8 hours
		await ns.sleep(8 * 3600 * 1000);

		// make sure we're actually done working
		while (ns.singularity.isFocused()) {
			await ns.sleep(5000);
		}
	}
}