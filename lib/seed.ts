import type { District, ParsedSection } from "./types";

// Seed comparison pool: three fictional peer districts with realistic values
// (ranges informed by real NY teacher contracts). This is the "existing pool"
// the demo opens on — then a real contract (e.g. Cohoes) parses in live and
// joins it. Seed sections are "confirmed" (a human already vetted them — the
// answer-key role the README describes).

function s(
  taxonomyKey: string,
  extractedValue: string,
  sourceText: string,
): ParsedSection {
  return {
    taxonomyKey,
    extractedValue,
    sourceText,
    confidence: 1,
    status: "confirmed",
  };
}

const maplewood: District = {
  id: "seed-maplewood",
  name: "Maplewood UFSD",
  term: "2022–2026",
  source: "seed",
  inPool: true,
  createdAt: 0,
  sections: [
    s(
      "recognition",
      "All certificated teaching staff; excludes administrators",
      "The District recognizes the Association as the exclusive bargaining representative for all certificated teaching personnel, excluding the Superintendent, Assistant Superintendents, and building Principals.",
    ),
    s(
      "work_year",
      "184 days",
      "The work year for teachers shall consist of 184 days, of which not more than 181 shall be instructional days and the remainder superintendent's conference days.",
    ),
    s(
      "class_size",
      "27 students (max)",
      "Class size shall not exceed 27 students in grades K–6. The parties recognize that class size affects instruction and shall consult where enrollment exceeds this level.",
    ),
    s(
      "salary_schedule",
      "$46,200 start / $89,400 max",
      "Step 1 (BA) base salary shall be $46,200. The maximum step (MA+60, Step 22) shall be $89,400 for the 2022–23 school year.",
    ),
    s(
      "salary_differential",
      "Coaching $2,100–$6,800; dept. chair $3,500",
      "Extra-duty stipends range from $2,100 (assistant coach) to $6,800 (varsity head coach). Department chairpersons receive $3,500 annually.",
    ),
    s(
      "health_insurance",
      "80% individual / 75% family",
      "The District shall contribute 80% of the premium for individual coverage and 75% for family coverage under the base plan for active employees.",
    ),
    s(
      "sick_leave",
      "12 days/yr; accrues to 200",
      "Teachers shall be granted twelve (12) sick days per year, accumulating to a maximum of two hundred (200) days.",
    ),
    s(
      "bereavement",
      "4 days (immediate family)",
      "A teacher shall be granted up to four (4) days of paid leave for a death in the immediate family, with no deduction from sick leave.",
    ),
    s(
      "personal_leave",
      "2 days/yr",
      "Each teacher shall be entitled to two (2) days of personal leave per year, non-cumulative, with prior notice to the building principal.",
    ),
    s(
      "extended_leave",
      "Child-care leave up to 2 years; sabbatical at 1/2 pay",
      "Child-care leave of absence may be granted for up to two years. Sabbatical leave may be granted to tenured teachers at one-half salary for one year.",
    ),
    s(
      "evaluation",
      "3 formal observations/yr (untenured)",
      "Untenured teachers shall receive a minimum of three formal observations annually; tenured teachers, one, consistent with the District's APPR plan.",
    ),
    s(
      "rif",
      "By seniority within tenure area; 7-yr recall",
      "In the event of a reduction in force, layoffs shall proceed in inverse order of seniority within tenure area. Recall rights continue for seven years.",
    ),
    s(
      "retirement",
      "$12,000 at 15+ years",
      "A teacher retiring with fifteen or more years of District service shall receive a one-time retirement incentive of $12,000.",
    ),
    s(
      "grievance",
      "4 steps; binding arbitration",
      "The grievance procedure consists of four steps culminating in binding arbitration before a mutually selected arbitrator.",
    ),
    s("duration", "2022–2026", "This Agreement shall be effective July 1, 2022 through June 30, 2026."),
  ],
};

const riverbend: District = {
  id: "seed-riverbend",
  name: "Riverbend CSD",
  term: "2023–2027",
  source: "seed",
  inPool: true,
  createdAt: 0,
  sections: [
    s(
      "recognition",
      "All certified teachers and nurses; excludes admin",
      "The Board recognizes the Association as sole bargaining agent for all certified classroom teachers and school nurses, excluding administrative and supervisory personnel.",
    ),
    s(
      "work_year",
      "186 days",
      "The teacher work year shall not exceed 186 days, including up to four conference days as designated by the Superintendent.",
    ),
    s(
      "class_size",
      "25 students (max)",
      "The District shall make every reasonable effort to maintain class sizes at or below 25 students in elementary grades.",
    ),
    s(
      "salary_schedule",
      "$51,000 start / $95,600 max",
      "The starting base salary (Step 1, BA) shall be $51,000 effective 2023–24. The maximum schedule placement shall be $95,600.",
    ),
    s(
      "salary_differential",
      "Coaching $2,500–$7,400; coordinators $4,000",
      "Athletic stipends range from $2,500 to $7,400. Curriculum coordinators receive an annual stipend of $4,000.",
    ),
    s(
      "health_insurance",
      "90% individual / 80% family",
      "The District shall pay ninety percent (90%) of the individual premium and eighty percent (80%) of the family premium for the base health plan.",
    ),
    s(
      "sick_leave",
      "18 days/yr; accrues to 250",
      "Teachers shall receive eighteen (18) sick days annually, accumulating without limit up to two hundred fifty (250) days.",
    ),
    s(
      "bereavement",
      "5 days (immediate family)",
      "Up to five (5) days of paid bereavement leave shall be granted for each death in the immediate family, with no charge to sick leave.",
    ),
    s(
      "personal_leave",
      "4 days/yr",
      "Each teacher is entitled to four (4) days of personal leave per school year, two of which may be used without stated reason.",
    ),
    s(
      "extended_leave",
      "Child-care leave up to 3 years; sabbatical at full pay (1 sem.)",
      "Child-care leave may extend to three years. A one-semester sabbatical at full salary may be granted for approved study.",
    ),
    s(
      "evaluation",
      "Per APPR; 2 formal observations/yr",
      "All teachers receive a minimum of two formal observations per year under the District's approved APPR plan.",
    ),
    s(
      "rif",
      "By seniority within tenure area; 4-yr recall",
      "Reductions shall be made in reverse seniority order within the affected tenure area, with recall rights for four years.",
    ),
    s(
      "retirement",
      "$15,000 at 10+ years",
      "Teachers retiring with at least ten years of service shall receive a retirement incentive of $15,000, payable over two years.",
    ),
    s(
      "grievance",
      "3 steps; binding arbitration",
      "Grievances proceed through three steps, the final being binding arbitration under AAA rules.",
    ),
    s("duration", "2023–2027", "This Agreement is effective from July 1, 2023 to June 30, 2027."),
  ],
};

const northgate: District = {
  id: "seed-northgate",
  name: "Northgate UFSD",
  term: "2021–2025",
  source: "seed",
  inPool: true,
  createdAt: 0,
  sections: [
    s(
      "recognition",
      "All teachers, teaching assistants & nurses",
      "The District recognizes the Association as the exclusive representative of all teachers, teaching assistants, and registered nurses employed by the District.",
    ),
    s(
      "work_year",
      "182 days",
      "The work year shall consist of 182 days, including 180 instructional days and two conference days.",
    ),
    s(
      "class_size",
      "30 students (max)",
      "Class size shall not exceed 30 pupils except for study halls, physical education, and music ensembles.",
    ),
    s(
      "salary_schedule",
      "$44,800 start / $84,100 max",
      "Beginning teacher salary (Step 1, BA) is $44,800. The top of the schedule (MA+45) is $84,100 for 2021–22.",
    ),
    s(
      "salary_differential",
      "Coaching $1,900–$6,200; club advisors $1,200",
      "Coaching stipends range from $1,900 to $6,200. Club and activity advisors receive $1,200 per assignment.",
    ),
    s(
      "health_insurance",
      "85% individual / 70% family",
      "The District contributes eighty-five percent (85%) toward individual and seventy percent (70%) toward family premiums for the base plan.",
    ),
    s(
      "sick_leave",
      "15 days/yr; accrues to 200",
      "Each teacher shall be credited with fifteen (15) sick days per year, accumulating to a maximum of 200 days.",
    ),
    s(
      "bereavement",
      "3 days (immediate family)",
      "Three (3) days of paid leave shall be allowed for a death in the immediate family; additional days may be charged to personal or sick leave.",
    ),
    s(
      "personal_leave",
      "3 days/yr",
      "Teachers are granted three (3) personal days per year, requiring 48 hours' notice except in emergencies.",
    ),
    s(
      "extended_leave",
      "Child-care leave up to 2 years; sabbatical not offered",
      "Unpaid child-care leave may be granted for up to two years. The District does not currently offer sabbatical leave.",
    ),
    s(
      "evaluation",
      "Per APPR; 3 observations untenured / 1 tenured",
      "Observation frequency follows the APPR plan: three formal observations for untenured staff and one for tenured staff annually.",
    ),
    s(
      "rif",
      "By seniority within tenure area; 7-yr recall",
      "Layoffs follow inverse seniority within tenure area; recall rights are preserved for seven years.",
    ),
    s(
      "retirement",
      "$10,000 at 15+ years",
      "A retirement incentive of $10,000 is available to teachers with fifteen or more years of service who provide notice by February 1.",
    ),
    s(
      "grievance",
      "4 steps; advisory arbitration",
      "The four-step grievance procedure concludes with advisory (non-binding) arbitration.",
    ),
    s("duration", "2021–2025", "This Agreement covers the period July 1, 2021 through June 30, 2025."),
  ],
};

export const SEED_DISTRICTS: District[] = [maplewood, riverbend, northgate];
