/**
 * @typedef {string | number | boolean | string[]} FlagValue
 * @typedef {function(AutoCompleteData, string[])} AutoCompleteFunc
 * @typedef {[string, FlagValue, string?, AutoCompleteFunc?]} Flag
 */

/**
 * @typedef {object} AutoCompleteData
 * @property {string[]} servers
 * @property {string[]} txts
 * @property {string[]} scripts
 * @property {function(Flag[]): void} flags
 */

/** 
 * @param {NS} ns
 * @param {Flag[]} flags
 * @param {string?} title
 */
export function help(ns, flags, title) {
	if (!title) title = ns.getScriptName();

	ns.tprintf(title);
	ns.tprintf("Arguments:\n");

	for (let f of flags) {
		const def = f[1];
		if (def === "" || def === undefined || def === null) { // no default value
			ns.tprintf("\t--%s\t\t%s\n", f[0], f[2]);
		} else {
			ns.tprintf("\t--%s\t\t%s Default: %s.\n", f[0], f[2], f[1]);
		}
	}
}

/**
 * @param {Flag[]} flags
 * 
 * @return {AutoCompleteFunc}
 */
export function autocompleter(flags) {
	/**
	 * @param {AutoCompleteData} data
	 * @param {string[]} args
	 */
	return (data, args) => {
		if (!args || args.length === 0) {
			data.flags(flags);
			return [];
		}
	
		const current = args[args.length - 1];
		const previous = args.length > 1 && !current.startsWith("--") ? args[args.length - 2] : current;

		console.log({current, previous});

		for (let f of flags) {
			if (f.length > 3 && "--" + f[0] === previous) {
				console.log("returning for", f[0]);
				return f[3](data, args);
			}
		}

		console.log("returning flags (default)");
		data.flags(flags);
		return [];
	};
}