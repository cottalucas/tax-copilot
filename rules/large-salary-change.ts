import type { Flag, Rule } from "./types.js";

/**
 * Example rule, not a tax rule: flags a big change in total gross salary from last year.
 * Supports the review screen's "changes from last year" section (SR-20).
 * TODO(SR-19): confirm the threshold with her. 20% is a placeholder.
 */
export const LARGE_CHANGE_THRESHOLD = 0.2;

function totalGross(employment: { grossSalary: { value: number } }[]): number {
  return employment.reduce((sum, e) => sum + e.grossSalary.value, 0);
}

export const largeSalaryChange: Rule = {
  id: "large-salary-change",
  description: "Total gross salary changed by more than the threshold compared with last year.",
  evaluate({ current, previous }): Flag[] {
    if (!previous) return [];
    const before = totalGross(previous.employment);
    const now = totalGross(current.employment);
    if (before === 0) return [];
    const change = (now - before) / before;
    if (Math.abs(change) <= LARGE_CHANGE_THRESHOLD) return [];
    const pct = Math.round(change * 100);
    return [
      {
        ruleId: this.id,
        severity: "warning",
        field: "employment",
        reason: `Gross salary is ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% from last year. Check for a new job, a bonus or a missing salary statement.`,
      },
    ];
  },
};
