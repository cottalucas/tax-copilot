import type { Flag, Rule } from "./types.js";

/**
 * Consistency checks on the extracted documents (SR-19). They hold no tax know-how: they catch
 * documents that are missing, misread or counted twice, before she relies on the numbers. Real
 * canton rules (Zurich) wait for the private repo (SR-23).
 */

export const noSalaryStatement: Rule = {
  id: "no-salary-statement",
  description: "No salary statement was found among the documents.",
  evaluate({ current }): Flag[] {
    if (current.employment.length > 0) return [];
    return [
      {
        ruleId: this.id,
        severity: "warning",
        field: "employment",
        reason: "No salary statement was found. Check whether one is missing, or whether the client had no employment income.",
      },
    ];
  },
};

export const netAboveGross: Rule = {
  id: "net-above-gross",
  description: "A salary statement shows a net salary higher than its gross salary.",
  evaluate({ current }): Flag[] {
    return current.employment.flatMap((e, i) =>
      e.netSalary && e.netSalary.value > e.grossSalary.value
        ? [
            {
              ruleId: this.id,
              severity: "critical" as const,
              field: `employment.${i}.netSalary`,
              reason: `The net salary from ${e.employer.value} is higher than the gross salary. One of the two was probably misread. Check the source page.`,
            },
          ]
        : [],
    );
  },
};

export const duplicateEmployer: Rule = {
  id: "duplicate-employer",
  description: "The same employer appears on more than one salary statement.",
  evaluate({ current }): Flag[] {
    const seen = new Map<string, number>();
    const flags: Flag[] = [];
    current.employment.forEach((e, i) => {
      const key = e.employer.value.trim().toLowerCase();
      if (seen.has(key)) {
        flags.push({
          ruleId: this.id,
          severity: "warning",
          field: `employment.${i}.employer`,
          reason: `${e.employer.value} appears on two salary statements. Check that the same statement was not uploaded twice.`,
        });
      } else seen.set(key, i);
    });
    return flags;
  },
};
