// A bundled sample contract (Cohoes) so Upload's "Load a sample" can demo the
// full Upload → Parse → Review document-reader arc without a real PDF. The text
// is fed through the real /api/parse pipeline (which now emits anchors), and the
// per-page array powers the document reader.

const COHOES_PAGE_1 = `COHOES CITY SCHOOL DISTRICT
Agreement with the Cohoes Teachers' Association
July 1, 2023 through June 30, 2028

ARTICLE I — RECOGNITION
The District recognizes the Cohoes Teachers' Association as the sole and exclusive negotiating agent for all teaching personnel, excluding administrative, supervisory, and confidential employees.

ARTICLE IV — WORK YEAR
The normal work year shall be one hundred eighty-five (185) days, inclusive of three (3) superintendent's conference days. The workday shall not exceed seven and one-quarter (7.25) hours.

ARTICLE VII — CLASS SIZE
The parties acknowledge the importance of reasonable class sizes. Specific limits are addressed through the building-level Instructional Council rather than fixed in this Agreement.

ARTICLE IX — SALARY SCHEDULE
The 2023–24 starting salary (Step 1, Bachelor's) shall be $48,500, with a maximum schedule value of $92,300 at MA+60. Annual step movement is granted to all eligible staff.

ARTICLE X — DIFFERENTIALS & EXTRA DUTY
A schedule of extra-compensation activities appears in Appendix C. Stipends are expressed as a percentage of base (3%–11%) rather than flat dollars.`;

const COHOES_PAGE_2 = `ARTICLE XI — HEALTH INSURANCE
The District shall contribute eighty-eight percent (88%) of the individual premium and seventy-eight percent (78%) of the dependent premium for active employees enrolled in the base plan.

ARTICLE XII — LEAVES
Teachers shall be credited with fifteen (15) sick leave days per year, cumulative to a maximum of two hundred twenty (220) days. In the event of death in the immediate family, a teacher may be absent for a period reasonably necessary, generally not to exceed five school days, subject to the discretion of the Superintendent.

ARTICLE XV — TECHNOLOGY & REMOTE INSTRUCTION
Teachers required to deliver remote instruction shall be provided a District device and a one-time $400 connectivity stipend. Remote instruction days count toward the contractual work year.

ARTICLE XVI — MENTORING PROGRAM
First-year teachers shall be assigned a trained mentor and released for four half-days of co-planning; mentors receive a $1,200 annual stipend payable in June.`;

export const SAMPLE_DISTRICT_NAME = "Cohoes City SD";

/** Per-page text — fed to the document reader and joined for the parser. */
export const SAMPLE_PAGES: string[] = [COHOES_PAGE_1, COHOES_PAGE_2];

/** Combined text sent to /api/parse (pages joined the same way uploads are). */
export const SAMPLE_TEXT = SAMPLE_PAGES.join("\n\n");
