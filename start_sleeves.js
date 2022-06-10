/** @param {NS} ns */
export async function main(ns) {
	const crimes = [
		"Shoplift",
		"Rob Store",
		"Mug",
		"Larceny",
		"Deal Drugs",
		"Bond Forgery",
		"Traffick Arms",
		"Homicide",
		"Grand Theft Auto",
		"Kidnap",
		"Assassination",
		"Heist",
	];

	const num = ns.sleeve.getNumSleeves();

	for (let i = 0; i < num; ++i) {
		const curr_task = ns.sleeve.getTask(i);
		if (curr_task.task !== "Idle") continue;

		const task = random_element(crimes);
		if (!ns.sleeve.setToCommitCrime(i, task)) {
			ns.toast(ns.sprintf("failed to assign task '%s' to sleeve #%d", task, i), ns.enums.toast.ERROR);
		}
	}
}

function random_element(list) {
	return list[Math.floor(Math.random() * list.length)];
}