// The normalized comparison taxonomy.
//
// Districts number their contract Articles differently (Cohoes uses Articles I–XVII),
// so we don't compare by article number — we map every contract into this fixed list
// of *concepts*. That's what makes "show me bereavement leave across 6 districts"
// possible. Derived from the Cohoes Teachers' Agreement table of contents, which is
// representative of NY collective bargaining agreements.
//
// `valueHint` is fed to the parser: it tells the model what the scannable, comparable
// "value" for this section is (a number of days, a percentage, a dollar figure), so the
// extracted value is something Compare can summarize as min / max / median.

export type ValueKind = "number" | "money" | "percent" | "text";

export interface TaxonomySection {
  key: string;
  label: string;
  /** Shown to users; also helps the model decide what belongs here. */
  description: string;
  /** Guides extraction of the single comparable value. */
  valueHint: string;
  /** How Compare should treat the value for min/max/median. */
  valueKind: ValueKind;
  /** Unit suffix for display, e.g. "days", "%". */
  unit?: string;
}

export const TAXONOMY: TaxonomySection[] = [
  {
    key: "recognition",
    label: "Recognition",
    description:
      "Which employees the union represents — the definition of the bargaining unit.",
    valueHint:
      "A short description of the bargaining unit (e.g. 'all certified teachers excluding administrators').",
    valueKind: "text",
  },
  {
    key: "work_year",
    label: "Work Year & Workday",
    description:
      "Length of the school/work year for teachers and the length of the workday.",
    valueHint:
      "Number of work days per year if stated (e.g. 186). If only the workday length is given, capture hours.",
    valueKind: "number",
    unit: "days",
  },
  {
    key: "class_size",
    label: "Class Size",
    description: "Maximum or target class sizes, including any ESL/special caps.",
    valueHint:
      "The maximum students per class if a single cap is stated (e.g. 28). Note variation by level in the value text.",
    valueKind: "number",
    unit: "students",
  },
  {
    key: "salary_schedule",
    label: "Salary Schedule",
    description:
      "Base salary schedule — starting (Step 1, BA) and maximum (top step) base pay.",
    valueHint:
      "Starting base salary in dollars (e.g. 48000). Capture the top-step figure in the value text too.",
    valueKind: "money",
    unit: "$",
  },
  {
    key: "salary_differential",
    label: "Salary Differentials & Extra Duty",
    description:
      "Stipends and extra-duty pay (coaching, coordinators, in-service, summer school).",
    valueHint:
      "A representative stipend figure or range in dollars. Summarize the notable ones in the value text.",
    valueKind: "money",
    unit: "$",
  },
  {
    key: "health_insurance",
    label: "Health Insurance",
    description:
      "Health insurance coverage and the district's contribution toward premiums.",
    valueHint:
      "District premium contribution as a percent for active individual coverage (e.g. 85). Note family/retiree terms in the value text.",
    valueKind: "percent",
    unit: "%",
  },
  {
    key: "sick_leave",
    label: "Sick Leave",
    description: "Annual sick leave allowance and accumulation cap.",
    valueHint:
      "Sick days granted per year (e.g. 15). Capture the accumulation cap in the value text.",
    valueKind: "number",
    unit: "days",
  },
  {
    key: "bereavement",
    label: "Bereavement Leave",
    description: "Paid leave on the death of a family member.",
    valueHint:
      "Days allowed for an immediate-family death (e.g. 5). Note extended-family terms in the value text.",
    valueKind: "number",
    unit: "days",
  },
  {
    key: "personal_leave",
    label: "Personal Leave",
    description: "Paid personal-business days.",
    valueHint: "Personal days granted per year (e.g. 3).",
    valueKind: "number",
    unit: "days",
  },
  {
    key: "extended_leave",
    label: "Extended & Child-Care Leave",
    description:
      "Sabbaticals, child-care leave, and other extended leaves of absence.",
    valueHint:
      "Maximum length of child-care/extended leave if stated (e.g. '2 years'). Summarize sabbatical terms in the value text.",
    valueKind: "text",
  },
  {
    key: "evaluation",
    label: "Teacher Evaluation",
    description: "How teachers are evaluated and observation requirements.",
    valueHint:
      "Number of formal observations per year if stated; otherwise a one-line summary of the evaluation plan.",
    valueKind: "text",
  },
  {
    key: "rif",
    label: "Reduction in Force",
    description: "Layoff procedure and order (seniority, recall rights).",
    valueHint: "One-line summary of the layoff/recall basis (e.g. 'by seniority within tenure area').",
    valueKind: "text",
  },
  {
    key: "retirement",
    label: "Retirement Incentive",
    description: "Retirement incentive or severance payout.",
    valueHint:
      "The incentive value in dollars if a figure is given; otherwise summarize the formula.",
    valueKind: "money",
    unit: "$",
  },
  {
    key: "grievance",
    label: "Grievance Procedure",
    description: "Steps for resolving disputes, up to and including arbitration.",
    valueHint:
      "Number of steps and whether it ends in binding arbitration — a one-line summary.",
    valueKind: "text",
  },
  {
    key: "duration",
    label: "Term of Agreement",
    description: "The dates the contract covers.",
    valueHint: "The term as a range (e.g. '2023–2027').",
    valueKind: "text",
  },
];

export const TAXONOMY_BY_KEY: Record<string, TaxonomySection> =
  Object.fromEntries(TAXONOMY.map((s) => [s.key, s]));

export function sectionLabel(key: string): string {
  return TAXONOMY_BY_KEY[key]?.label ?? key;
}
