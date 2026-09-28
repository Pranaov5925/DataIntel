export type TaskStatus = "Running" | "Complete" | "Needs review" | "Queued";

export const DEMO_REQUEST =
  "Find Indian SaaS companies currently hiring Java backend developers. Include company name, role, location, required experience, salary if available, company size, and source.";

export const tasks = [
  {
    id: "DR-1048",
    name: "Indian SaaS companies hiring Java backend developers",
    status: "Running" as TaskStatus,
    progress: 82,
    records: 36,
    quality: 88,
    updated: "2 min ago",
  },
  {
    id: "DR-1047",
    name: "Java backend jobs in Bengaluru (last 14 days)",
    status: "Complete" as TaskStatus,
    progress: 100,
    records: 58,
    quality: 91,
    updated: "Today, 10:42",
  },
  {
    id: "DR-1046",
    name: "Indian SaaS companies hiring software engineers",
    status: "Needs review" as TaskStatus,
    progress: 100,
    records: 112,
    quality: 79,
    updated: "Yesterday",
  },
  {
    id: "DR-1045",
    name: "Spring Boot developer openings in Pune & Hyderabad",
    status: "Complete" as TaskStatus,
    progress: 100,
    records: 41,
    quality: 93,
    updated: "Sep 22",
  },
  {
    id: "DR-1044",
    name: "Indian B2B SaaS companies with 100–1,000 employees",
    status: "Complete" as TaskStatus,
    progress: 100,
    records: 187,
    quality: 95,
    updated: "Sep 20",
  },
];

export const understanding = [
  ["Target", "Job openings"],
  ["Geography", "India"],
  ["Industry", "SaaS"],
  ["Constraint", "Java backend roles"],
  ["Required fields", "Company, Role, Location, Experience, Salary, Company Size, Source"],
  ["Freshness", "Listings active in the last 30 days"],
] as const;

export const workflowStages = [
  {
    name: "Discover relevant job listings and companies",
    detail: "9 permitted job boards and careers pages selected",
    status: "complete",
    count: "1m 12s",
  },
  {
    name: "Collect candidate records",
    detail: "47 candidate listings collected",
    status: "complete",
    count: "47",
  },
  {
    name: "Extract required fields",
    detail: "7 fields mapped per listing",
    status: "complete",
    count: "329 values",
  },
  {
    name: "Validate source evidence",
    detail: "Every value linked to a source snippet",
    status: "complete",
    count: "31 valid",
  },
  {
    name: "Deduplicate records",
    detail: "Same role posted on multiple boards merged",
    status: "complete",
    count: "−11",
  },
  {
    name: "Identify missing or conflicting information",
    detail: "Salary gaps and company size conflicts flagged",
    status: "complete",
    count: "29 gaps",
  },
  {
    name: "Perform targeted verification",
    detail: "Adaptive searches for missing salary evidence",
    status: "active",
    count: "78%",
  },
  {
    name: "Publish final dataset",
    detail: "Evidence-backed dataset with citations",
    status: "pending",
    count: "—",
  },
];

export type Verification = "Confirmed" | "Partially verified" | "Needs verification";
export type Evidence = {
  field: string;
  value: string;
  source: string;
  url: string;
  retrieved: string;
  snippet: string;
  verification: Verification;
};
export type ConflictValue = {
  source: string;
  value: string;
  url: string;
  retrieved: string;
  snippet: string;
};
export type DatasetRecord = {
  id: string;
  company: string;
  role: string;
  location: string;
  experience: string;
  salary: string;
  size: string;
  source: string;
  confidence: number;
  status: "Verified" | "Review" | "Conflict" | "Incomplete";
  evidence: Evidence[];
  conflict?: { field: string; values: ConflictValue[] };
};

const ev = (
  field: string,
  value: string,
  source: string,
  url: string,
  snippet: string,
  verification: Verification = "Confirmed",
  retrieved = "Sep 27, 14:32 IST",
): Evidence => ({ field, value, source, url, retrieved, snippet, verification });

export const datasetRows: DatasetRecord[] = [
  {
    id: "R-001",
    company: "Freshworks",
    role: "Senior Java Backend Engineer",
    location: "Chennai",
    experience: "4–7 yrs",
    salary: "₹22–32 LPA",
    size: "5,000+",
    source: "Company Careers",
    confidence: 97,
    status: "Verified",
    evidence: [
      ev(
        "Role",
        "Senior Java Backend Engineer",
        "Company Careers",
        "careers.freshworks.com/jobs/sr-java-backend-2291",
        "“Senior Java Backend Engineer – Freshdesk Platform. Build scalable microservices using Java 17 and Spring Boot.”",
      ),
      ev(
        "Location",
        "Chennai",
        "Company Careers",
        "careers.freshworks.com/jobs/sr-java-backend-2291",
        "“Location: Chennai, Tamil Nadu (Hybrid)”",
      ),
      ev(
        "Experience",
        "4–7 yrs",
        "Company Careers",
        "careers.freshworks.com/jobs/sr-java-backend-2291",
        "“4 to 7 years of experience building backend services in Java.”",
      ),
      ev(
        "Salary",
        "₹22–32 LPA",
        "Naukri",
        "naukri.com/job-listings-senior-java-freshworks-chennai",
        "“CTC: 22–32 Lacs P.A.”",
        "Confirmed",
        "Sep 27, 14:38 IST",
      ),
      ev(
        "Company Size",
        "5,000+",
        "LinkedIn",
        "linkedin.com/company/freshworks-inc",
        "“Company size: 5,001–10,000 employees”",
      ),
    ],
  },
  {
    id: "R-002",
    company: "Zoho",
    role: "Java Developer – Backend",
    location: "Chennai",
    experience: "2–5 yrs",
    salary: "₹8–14 LPA",
    size: "10,000+",
    source: "Company Careers",
    confidence: 95,
    status: "Verified",
    evidence: [
      ev(
        "Role",
        "Java Developer – Backend",
        "Company Careers",
        "careers.zohocorp.com/jobs/java-developer-4471",
        "“We are looking for Java Developers to build high-performance server-side components.”",
      ),
      ev(
        "Experience",
        "2–5 yrs",
        "Company Careers",
        "careers.zohocorp.com/jobs/java-developer-4471",
        "“Experience: 2–5 years”",
      ),
      ev(
        "Salary",
        "₹8–14 LPA",
        "Glassdoor",
        "glassdoor.co.in/Salary/Zoho-Java-Developer",
        "“Java Developer at Zoho: ₹8L – ₹14L per year (based on 312 salaries)”",
        "Partially verified",
        "Sep 27, 14:41 IST",
      ),
      ev(
        "Company Size",
        "10,000+",
        "LinkedIn",
        "linkedin.com/company/zoho",
        "“Company size: 10,001+ employees”",
      ),
    ],
  },
  {
    id: "R-003",
    company: "Chargebee",
    role: "Backend Engineer (Java)",
    location: "Chennai / Bengaluru",
    experience: "3–6 yrs",
    salary: "₹18–28 LPA",
    size: "250 / 300",
    source: "LinkedIn",
    confidence: 78,
    status: "Conflict",
    evidence: [
      ev(
        "Role",
        "Backend Engineer (Java)",
        "LinkedIn",
        "linkedin.com/jobs/view/3990214471",
        "“Backend Engineer – Java, Billing Platform. Chennai or Bengaluru.”",
      ),
      ev(
        "Experience",
        "3–6 yrs",
        "Cutshort",
        "cutshort.io/job/Backend-Engineer-Java-Chargebee",
        "“Experience required: 3–6 years”",
      ),
      ev(
        "Salary",
        "₹18–28 LPA",
        "Cutshort",
        "cutshort.io/job/Backend-Engineer-Java-Chargebee",
        "“Salary: ₹18L – ₹28L / yr”",
        "Confirmed",
        "Sep 27, 14:39 IST",
      ),
      ev(
        "Company Size",
        "Conflicting values",
        "LinkedIn / Company About page",
        "—",
        "Two sources disagree. No value was selected automatically.",
        "Needs verification",
      ),
    ],
    conflict: {
      field: "Company Size",
      values: [
        {
          source: "LinkedIn",
          value: "250 employees",
          url: "linkedin.com/company/chargebee",
          retrieved: "Sep 27, 14:33 IST",
          snippet: "“Company size: 201–500 employees · 250 associated members”",
        },
        {
          source: "Company About page",
          value: "300 employees",
          url: "chargebee.com/company/about",
          retrieved: "Sep 27, 14:35 IST",
          snippet: "“A team of 300+ people across Chennai, Bengaluru, and San Francisco.”",
        },
      ],
    },
  },
  {
    id: "R-004",
    company: "Postman",
    role: "Software Engineer – Java Platform",
    location: "Bengaluru",
    experience: "2–4 yrs",
    salary: "Not disclosed",
    size: "1,000+",
    source: "Instahyre",
    confidence: 84,
    status: "Incomplete",
    evidence: [
      ev(
        "Role",
        "Software Engineer – Java Platform",
        "Instahyre",
        "instahyre.com/job-298814-software-engineer-java-postman",
        "“Software Engineer, Platform (Java, Kafka, AWS)”",
      ),
      ev(
        "Experience",
        "2–4 yrs",
        "Instahyre",
        "instahyre.com/job-298814-software-engineer-java-postman",
        "“2–4 years of backend experience”",
      ),
      ev(
        "Salary",
        "Not disclosed",
        "Instahyre",
        "instahyre.com/job-298814-software-engineer-java-postman",
        "No salary information published on this listing. Targeted search found no reliable alternative.",
        "Needs verification",
      ),
      ev(
        "Company Size",
        "1,000+",
        "LinkedIn",
        "linkedin.com/company/postman-platform",
        "“Company size: 1,001–5,000 employees”",
      ),
    ],
  },
  {
    id: "R-005",
    company: "Darwinbox",
    role: "SDE II – Java Backend",
    location: "Hyderabad",
    experience: "3–5 yrs",
    salary: "₹20–30 LPA",
    size: "1,000+",
    source: "Company Careers",
    confidence: 93,
    status: "Verified",
    evidence: [
      ev(
        "Role",
        "SDE II – Java Backend",
        "Company Careers",
        "darwinbox.com/careers/sde-2-java",
        "“SDE II (Java) – Core HRMS Platform, Hyderabad”",
      ),
      ev(
        "Salary",
        "₹20–30 LPA",
        "Cutshort",
        "cutshort.io/job/SDE-II-Java-Darwinbox",
        "“₹20L – ₹30L / yr · Hyderabad”",
        "Confirmed",
        "Sep 27, 14:40 IST",
      ),
      ev(
        "Company Size",
        "1,000+",
        "LinkedIn",
        "linkedin.com/company/darwinbox",
        "“Company size: 1,001–5,000 employees”",
      ),
    ],
  },
  {
    id: "R-006",
    company: "Browserstack",
    role: "Senior Backend Developer (Java)",
    location: "Mumbai",
    experience: "5–8 yrs",
    salary: "₹30–45 LPA",
    size: "1,000+",
    source: "LinkedIn",
    confidence: 90,
    status: "Verified",
    evidence: [
      ev(
        "Role",
        "Senior Backend Developer (Java)",
        "LinkedIn",
        "linkedin.com/jobs/view/3988120045",
        "“Senior Backend Developer – Java/Spring, Mumbai”",
      ),
      ev(
        "Salary",
        "₹30–45 LPA",
        "Glassdoor",
        "glassdoor.co.in/Salary/BrowserStack-Senior-Backend",
        "“₹30L – ₹45L per year (based on 64 salaries)”",
        "Partially verified",
        "Sep 27, 14:42 IST",
      ),
    ],
  },
  {
    id: "R-007",
    company: "Kissflow",
    role: "Java Backend Engineer",
    location: "Chennai",
    experience: "2–5 yrs",
    salary: "₹8–12 LPA",
    size: "500+",
    source: "Naukri",
    confidence: 88,
    status: "Review",
    evidence: [
      ev(
        "Role",
        "Java Backend Engineer",
        "Naukri",
        "naukri.com/job-listings-java-backend-kissflow-chennai",
        "“Java Backend Engineer – Workflow Platform”",
      ),
      ev(
        "Salary",
        "₹8–12 LPA",
        "Naukri",
        "naukri.com/job-listings-java-backend-kissflow-chennai",
        "“8–12 Lacs P.A.”",
        "Partially verified",
        "Sep 27, 14:43 IST",
      ),
    ],
  },
  {
    id: "R-008",
    company: "LeadSquared",
    role: "Backend Developer – Java",
    location: "Bengaluru",
    experience: "1–3 yrs",
    salary: "₹6–10 LPA",
    size: "1,000+",
    source: "Naukri",
    confidence: 86,
    status: "Review",
    evidence: [
      ev(
        "Role",
        "Backend Developer – Java",
        "Naukri",
        "naukri.com/job-listings-backend-java-leadsquared",
        "“Backend Developer (Java, MySQL, AWS)”",
      ),
      ev(
        "Salary",
        "₹6–10 LPA",
        "Naukri",
        "naukri.com/job-listings-backend-java-leadsquared",
        "“6–10 Lacs P.A.”",
        "Confirmed",
        "Sep 27, 14:44 IST",
      ),
    ],
  },
];

export const qualitySummary = {
  collected: 47,
  unique: 36,
  validated: 31,
  duplicates: 11,
  incomplete: 3,
  conflicts: 2,
};

export const sources = [
  {
    name: "Company Careers",
    domain: "careers pages (14)",
    type: "Primary",
    records: 18,
    reliability: 98,
    checked: "38 sec ago",
  },
  {
    name: "LinkedIn Jobs",
    domain: "linkedin.com",
    type: "Job board",
    records: 16,
    reliability: 92,
    checked: "2 min ago",
  },
  {
    name: "Naukri",
    domain: "naukri.com",
    type: "Job board",
    records: 12,
    reliability: 90,
    checked: "3 min ago",
  },
  {
    name: "Cutshort",
    domain: "cutshort.io",
    type: "Job board",
    records: 7,
    reliability: 91,
    checked: "5 min ago",
  },
  {
    name: "Instahyre",
    domain: "instahyre.com",
    type: "Job board",
    records: 5,
    reliability: 89,
    checked: "6 min ago",
  },
  {
    name: "Glassdoor",
    domain: "glassdoor.co.in",
    type: "Salary data",
    records: 9,
    reliability: 84,
    checked: "4 min ago",
  },
];

export const interventions = [
  {
    time: "14:31:40",
    title: "Initial collection complete",
    detail: "47 candidate records collected from 9 sources.",
    tone: "accent",
  },
  {
    time: "14:32:08",
    title: "Evidence gap detected",
    detail: "Salary evidence coverage is 42%. Salary is missing or insufficient for 29 records.",
    tone: "warning",
  },
  {
    time: "14:32:11",
    title: "Adaptive research triggered",
    detail:
      "Targeted searches on Naukri, Cutshort, and Glassdoor for records with missing salary evidence.",
    tone: "accent",
  },
  {
    time: "14:38:46",
    title: "Coverage recovered",
    detail:
      "Salary evidence coverage improved from 42% to 78%. 2 company size conflicts flagged for review.",
    tone: "success",
  },
];

export const adaptiveOutcomes = [
  ["+10", "Additional records verified"],
  ["11", "Duplicates removed"],
  ["2", "Conflicts detected"],
  ["29 → 8", "Incomplete records"],
] as const;

export const history = [
  {
    version: "v4",
    trigger: "Adaptive retry",
    change: "Targeted salary searches on Naukri, Cutshort, Glassdoor",
    outcome: "Salary evidence 42% → 78%",
    time: "Today, 14:32",
    records: "36 unique · 31 validated",
    sources: 9,
  },
  {
    version: "v3",
    trigger: "Quality threshold",
    change: "Required a second source for company size",
    outcome: "2 conflicts surfaced for review",
    time: "Today, 14:24",
    records: "36 unique · 24 validated",
    sources: 7,
  },
  {
    version: "v2",
    trigger: "Deduplication",
    change: "Merged identical roles posted on multiple job boards",
    outcome: "11 duplicates removed",
    time: "Today, 14:17",
    records: "36 unique",
    sources: 6,
  },
  {
    version: "v1",
    trigger: "Initial blueprint",
    change: "Generated 8-step collection blueprint from the request",
    outcome: "47 candidate records",
    time: "Today, 14:09",
    records: "47 collected",
    sources: 6,
  },
];
