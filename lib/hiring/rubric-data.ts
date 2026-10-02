// The hiring rubric. Source of truth for the rubric_criteria table (seeded on first use)
// and for rubric.txt. Derived from Kargo's 8 past hire profiles, NOT from the job descriptions.
//
// Method: compare the five "Exceeds Expectations" hires (Rohan Desai, Sunita Krishnamurthy,
// Aditya Shetty, Meghna Tiwari, Lavanya Iyer) with the three "Meets" / "Below" hires
// (Vikram Nair, Rahul Bose, Preetham Rao) and keep what separates the two groups on the page.

export type Role = "PM" | "SPM";

export type RubricCriterion = {
  role: Role;
  position: number;
  name: string;
  description: string;
  weight: number; // percent; sums to 100 per role
};

/** Where each criterion came from, for rubric.txt only. */
export const SOURCES: Record<string, string> = {
  "Floor-Level Operator Time":
    "Rohan Desai (customs/CHA operations, JNPT), Sunita Krishnamurthy (freight documentation), Aditya Shetty (port terminal sales at JNPT), Meghna Tiwari (freight forwarder client desk), Lavanya Iyer (3PL carrier operations) all did operational work in logistics before or alongside their current job. Vikram Nair (HR tech), Preetham Rao (e-commerce backend) and Rahul Bose (fintech marketing) had none.",
  "Unprompted Fix That Others Adopted":
    "Rohan Desai (Bill of Lading tool prototyped over a weekend, 30 colleagues using it in a month; Excel shipment tracker adopted by 12), Sunita Krishnamurthy (redesigned documentation intake over a weekend, kept permanently), Meghna Tiwari (30-60-90 onboarding framework the whole CS team uses), Lavanya Iyer (Excel visibility dashboard adopted by 2 other regional teams). Preetham Rao's and Vikram Nair's fixes were inside their defined team scope, with no adoption by others named.",
  "Owned It With No One Above":
    "Rohan Desai (\"translate field requirements into engineering spec without a product layer\"), Sunita Krishnamurthy (\"owning processes start to finish with limited oversight\"), Aditya Shetty (\"no account manager layer between the client and execution\"), Meghna Tiwari (no escalation to management in 14 months), Lavanya Iyer (sole PM; \"doesn't hedge\"). Vikram Nair and Preetham Rao worked as one member of a 4-person PM team and a 12-engineer team.",
  "Failure On The Record":
    "Aditya Shetty (4 months on an account that did not buy; wrote the root-cause post-mortem, now standard practice), Lavanya Iyer (killed 2 shipped features on usage data; wrote the outage post-mortem). The three lower-rated CVs list wins only.",
};

export const RUBRIC: RubricCriterion[] = [
  // ------------------------------------------------------------------ PM
  {
    role: "PM",
    position: 1,
    name: "Floor-Level Operator Time",
    weight: 25,
    description:
      "Has personally done day-to-day operational work in freight, shipping, ports, customs, warehousing or carrier operations: handled shipments, documents, carriers, clients or terminals, in a job where that work was the job. " +
      "Strong (8-10): 18+ months in such a role, shown by concrete operational detail (named documents, carriers, ports, volumes per month). " +
      "Middling (4-7): shorter stint, or a software or customer role that sat very close to logistics operations (e.g. support or onboarding for freight-forwarder users). " +
      "Weak (0-3): domain knowledge claimed in the summary only, or experience limited to building or marketing software for logistics without doing the operations.",
  },
  {
    role: "PM",
    position: 2,
    name: "Unprompted Fix That Others Adopted",
    weight: 30,
    description:
      "Noticed something broken that nobody assigned them, built a first version quickly (days or weeks, not a quarter), and other people started using it without being told to. " +
      "Strong (8-10): the CV names the problem, says they built it themselves, and gives adoption evidence (number of users, teams or accounts, or that it became the standard). " +
      "Middling (4-7): self-started and shipped, but no evidence anyone else adopted it; or adopted, but it was part of the assigned job. " +
      "Weak (0-3): every achievement is an assigned project delivered inside a defined team scope.",
  },
  {
    role: "PM",
    position: 3,
    name: "Owned It With No One Above",
    weight: 25,
    description:
      "Held end-to-end ownership of a product, process or account where there was no senior person or layer above to make the calls. " +
      "Strong (8-10): sole PM, first PM, or sole owner of an area; the CV says no one above, or shows decisions made and shipped alone. " +
      "Middling (4-7): owned a module but with a senior PM, committee or sign-off chain above for the major calls. " +
      "Weak (0-3): contributor within a team of peers or specialists, with results described as the team's, or 'supported' someone else's decisions.",
  },
  {
    role: "PM",
    position: 4,
    name: "Failure On The Record",
    weight: 20,
    description:
      "Names something specific that did not work (a feature killed, a deal lost, a launch rolled back, an outage), says why, and says what changed afterwards. " +
      "Strong (8-10): a named failure, the root cause, and a lasting change (post-mortem written, process changed, feature killed on data). " +
      "Middling (4-7): admits something was dropped or did not land, with no cause or follow-up. " +
      "Weak (0-3): the CV lists only wins and metrics going up.",
  },
  // ----------------------------------------------------------------- SPM
  {
    role: "SPM",
    position: 1,
    name: "Floor-Level Operator Time",
    weight: 20,
    description:
      "Has personally done operational work in freight, shipping, ports, customs, warehousing or carrier operations, and has stayed close to operations users while building products. " +
      "Strong (8-10): 2+ years actually doing the operational work, AND still gets inputs from the floor (field visits, running operations sessions, weekly calls with carriers or ops teams) while in product roles. " +
      "Middling (4-7): 1-2 years of operational work, or a longer stint in logistics software without doing the operations. " +
      "Weak (0-3): domain stated in the summary only, or knowledge drawn from client workshops and account managers rather than the floor.",
  },
  {
    role: "SPM",
    position: 2,
    name: "Unprompted Fix That Others Adopted",
    weight: 25,
    description:
      "Noticed something broken that nobody assigned them, built or drove a fix quickly, and it spread beyond their own team without a mandate. " +
      "Strong (8-10): an unassigned fix that crossed team or customer boundaries (e.g. adopted by other teams, regions or several customers) or became the company standard, with numbers; repeated more than once. " +
      "Middling (4-7): one self-started fix with adoption inside their own team only. " +
      "Weak (0-3): improvements are all assigned roadmap items, or adoption is only inferred from the feature shipping.",
  },
  {
    role: "SPM",
    position: 3,
    name: "Owned It With No One Above",
    weight: 35,
    description:
      "Owned a whole product area, or the product function, with nobody senior above making the calls, and lived with the consequences. " +
      "Strong (8-10): first or only senior PM / head of product at an early-stage company; set the roadmap and the ways of working themselves; decisions with consequences beyond one sprint (build vs configure vs refuse, integrations or data design) are named, and the CV says what happened afterwards. " +
      "Middling (4-7): ran a product area day to day but major calls needed a VP or CPO sign-off, or ownership at a company where the rules were already written. " +
      "Weak (0-3): module owner inside a large product organisation, roadmap sign-off elsewhere (e.g. HQ), or the CV itself says rapid decisions were not part of the role.",
  },
  {
    role: "SPM",
    position: 4,
    name: "Failure On The Record",
    weight: 20,
    description:
      "Names something specific that did not work, a consequential call that went wrong, a feature or integration killed, or a bet that lost, with the cause and the lasting change. " +
      "Strong (8-10): a named failure at real stakes (customer-facing, revenue or reliability), an honest root cause that includes their own call, and a process or decision-framework change that stuck. " +
      "Middling (4-7): admits a miss without root cause, or only a small-stakes example. " +
      "Weak (0-3): wins only, or the CV states limited experience with killing or reversing decisions.",
  },
];

export function criteriaFor(role: Role) {
  return RUBRIC.filter((c) => c.role === role).sort((a, b) => a.position - b.position);
}

export function renderRubricTxt(): string {
  const out: string[] = [
    "KARGO HIRING RUBRIC",
    "",
    "Derived from the patterns that separate Kargo's 'Exceeds Expectations' hires (Rohan Desai, Sunita Krishnamurthy,",
    "Aditya Shetty, Meghna Tiwari, Lavanya Iyer) from the 'Meets' and 'Below' hires (Vikram Nair, Rahul Bose, Preetham Rao).",
    "Job descriptions were used only to understand the roles. Score each criterion 0-10 using only evidence written in the CV.",
    "A role score = sum of (weight x criterion score / 10), giving 0-100.",
    "",
  ];
  for (const role of ["PM", "SPM"] as Role[]) {
    out.push("=".repeat(60), role === "PM" ? "PRODUCT MANAGER (PM)" : "SENIOR PRODUCT MANAGER (SPM)", "=".repeat(60), "");
    for (const c of criteriaFor(role)) {
      out.push(
        `Criterion name: ${c.name}`,
        `What a strong candidate looks like: ${c.description}`,
        `Weight: ${c.weight}%`,
        `Source in hire profiles: ${SOURCES[c.name]}`,
        "",
      );
    }
    out.push(`Total weight: ${criteriaFor(role).reduce((s, c) => s + c.weight, 0)}%`, "");
  }
  return out.join("\n");
}
