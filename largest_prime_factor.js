/** @param {NS} ns */
export async function main(ns) {
	const num = ns.args[0];

	const results = generate_prime_factors(num);
	if (results === 0) {
		ns.tprint("No prime factor found");
		return;
	}

	let max = results[0];
	for (let r of results.slice(1)) {
		if (r > max) {
			max = r;
		}
	}

	ns.tprintf("Largest prime factor: %f", max);
}

export function generate_prime_factors(n) {
	const results = [];

	let d = 2;
	while (n > 1) {
		while (n % d === 0) {
			results.push(d);
			n /= d;
		}

		d++;

		if (d * d > n) {
			if (n > 1) {
				results.push(n);
			}
			break;
		}
	}

	return results;
}