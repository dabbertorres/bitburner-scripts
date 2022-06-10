import * as util from "util.js";

const flags = [
	["ascend_mult", 1.5, "Multiplier affect to wait for before ascending members."],
	["train_level", 100, "Hacking level to train new members to."],
	["noequipment", false, "Disable buying equipment."],
	["focus", "respect", "Focus on gaining 'respect' or 'money'.", () => ["respect", "money"]],
	["help", false, "Print this message."],
];

export const autocomplete = util.autocompleter(flags);

/** @param {NS} ns */
export async function main(ns) {
	const opts = ns.flags(flags);

    if (opts.help) {
        util.help(ns, flags, "gang.js: manage a gang");
        return;
    }

	if (!ns.gang.inGang()) {
		ns.tprint("Create a gang first.");
		return;
	}

	if (!ns.fileExists("Formulas.exe", "home")) {
		ns.tprint("cannot run - Formulas.exe is required")
		return;
	}

	const gang_info = ns.gang.getGangInformation();

	ns.disableLog("ALL");

	const equipment = get_rootkit_equipment(ns, gang_info.isHacking);

	const all_tasks = get_tasks(ns, gang_info.isHacking);

	const tasks_by_money = all_tasks.slice()
									.filter(task => task.baseMoney > 0)
									.sort((a, b) => b.baseMoney - a.baseMoney);

	const tasks_by_respect = all_tasks.slice()
									  .filter(task => task.baseRespect > 0)
									  .sort((a, b) => b.baseRespect - a.baseRespect);

	const tasks_by_wanted = all_tasks.slice()
									 .sort((a, b) => a.baseWanted - b.baseWanted); // ascending, not descending

	const tasks_for_training = all_tasks.slice()
										.filter(task => task.name.startsWith("Train"))
										.sort(gang_info.isHacking ? (a, b) => b.hackWeight - a.hackWeight
																  : (a, b) => b.strWeight - a.strWeight);

	const member_skill_select = gang_info.isHacking ? member => member.hack
													: member => member.str;

	const gain_tasks = opts.respect === "respect" ? tasks_by_respect
												  : tasks_by_money;

	while (true) {
		while (ns.gang.canRecruitMember()) {
			const name = "member-" + ns.gang.getMemberNames().length;
			if (!ns.gang.recruitMember(name)) {
				ns.printf("failed to recruit member '%s", name);
			}
		}

		const gang_info = ns.gang.getGangInformation();

		const members = ns.gang.getMemberNames()
							   .map(name => ns.gang.getMemberInformation(name));

		const task_assignments = new Map();
		let base_wanted_rate = 0;

		for (let m of members) {
			if (member_skill_select(m) < opts.train_level) {
				const task = tasks_for_training[0];
				task_assignments.set(m.name, task);
			} else {
				const task = tasks_by_wanted[0];
				const gain = ns.formulas.gang.wantedLevelGain(gang_info, m, task);
				base_wanted_rate += gain;
				task_assignments.set(m.name, task);
			}
		}

		if (base_wanted_rate < 0) {
			const iter = task_assignments[Symbol.iterator]();
			for (const [member, task] of iter) {
				const info = ns.gang.getMemberInformation(member);

				let new_task = gain_tasks[0];
				let new_wanted_rate = 0;
				for (let i = 0; i < gain_tasks.length; ++i) {
					new_task = gain_tasks[i];
					const old_gain = ns.formulas.gang.wantedLevelGain(gang_info, info, task);
					const new_gain = ns.formulas.gang.wantedLevelGain(gang_info, info, new_task);
					new_wanted_rate = base_wanted_rate - old_gain + new_gain;
					if (new_wanted_rate < 0) break;
				}

				if (new_wanted_rate > 0) {
					break;
				}

				base_wanted_rate = new_wanted_rate;
				task_assignments.set(member, new_task);
			}
		}

		const iter = task_assignments[Symbol.iterator]();
		for (const [member, task] of iter) {
			if (!opts.noequipment) {
				for (let e of equipment) {
					ns.gang.purchaseEquipment(member, e);
				}
			}

			const ascension = ns.gang.getAscensionResult(member);
			if (ascension !== undefined && ascension.hack >= opts.ascend_mult) {
				if (ns.gang.ascendMember(member) === undefined) {
					ns.printf("failed to ascend '%s'", member);
				} else {
					continue;
				}
			}
			
			const info = ns.gang.getMemberInformation(member);
			if (info.task !== task.name) {
				ns.gang.setMemberTask(member, task.name);
			}
		}

		await ns.sleep(3000);
	}
}

/** @param {NS} ns */
function get_rootkit_equipment(ns, isHacking) {
	const filter = isHacking ? name => ns.gang.getEquipmentType(name) === "Rootkit"
							 : name => ns.gang.getEquipmentType(name) !== "Rootkit";

	return ns.gang.getEquipmentNames()
		   .filter(filter);
}

/** @param {NS} ns */
function get_tasks(ns, isHacking) {
	return ns.gang.getTaskNames()
				  .map(task => ns.gang.getTaskStats(task))
				  .filter(isHacking ? task => task.isHacking
									: task => task.isCombat);
}