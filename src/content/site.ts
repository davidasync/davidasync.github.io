/**
 * Every piece of text on the site comes from this file.
 * Edit here, save, and the page updates — no need to touch the components.
 */

export type Social = {
  label: string;
  href: string;
  icon: "github" | "linkedin" | "medium";
};

export type Project = {
  title: string;
  blurb: string;
  description: string;
  tech: string[];
  year: string;
  demo?: string;
  code?: string;
  featured?: boolean;
};

export type Job = {
  role: string;
  company: string;
  companyUrl?: string;
  period: string;
  location: string;
  points: string[];
  stack: string[];
};

export type SkillGroup = {
  title: string;
  items: string[];
};

export const profile = {
  name: "davidasync",
  role: "Technical Lead",
  tagline:
    "I build scalable products and strengthen the engineering systems behind them — from partner APIs and cloud infrastructure to delivery, observability, and reliability.",
  location: "Jakarta, Indonesia",
  status: "Technical Lead at tiket.com",
  contactUrl:
    "https://www.linkedin.com/in/david-%E2%80%8F-2b66b6106/",
};

export const socials: Social[] = [
  { label: "GitHub", href: "https://github.com/davidasync", icon: "github" },
  {
    label: "LinkedIn",
    href: profile.contactUrl,
    icon: "linkedin",
  },
  {
    label: "Medium",
    href: "https://davidasync.medium.com",
    icon: "medium",
  },
];

export const about = {
  paragraphs: [
    "I’m a Technical Lead with more than a decade of experience building software products and the platforms that keep them reliable. I enjoy turning complex engineering problems into practical systems that teams can operate with confidence.",
    "At tiket.com, I work in the Affiliate accommodation team and partner closely with Product to enable integrations through our APIs. I joined as a Senior Software Engineer in 2022 and moved into the Technical Lead role in 2025.",
    "Previously, I worked across product engineering, cloud infrastructure, GitOps, observability, performance, and engineering excellence at LINE Indonesia and Traveloka, after earlier engineering roles at Cermati, IndoTrading, and BINUS.",
  ],
  facts: [
    {
      label: "Focus",
      value: "Backend systems, cloud infrastructure & reliability",
    },
    { label: "Experience", value: "11+ years in software engineering" },
    { label: "Currently", value: "Technical Lead at tiket.com" },
    {
      label: "Education",
      value: "B.Sc. Computer Science, BINUS · GPA 3.80",
    },
  ],
};

export const skillGroups: SkillGroup[] = [
  {
    title: "Leadership & Delivery",
    items: [
      "Technical leadership",
      "System design reviews",
      "Incident investigation",
      "Engineering excellence",
      "Product collaboration",
    ],
  },
  {
    title: "Cloud & Infrastructure",
    items: [
      "AWS",
      "Kubernetes",
      "Terraform",
      "AWS Lambda",
      "Elasticsearch",
      "Auto scaling",
    ],
  },
  {
    title: "DevOps & GitOps",
    items: [
      "Argo CD",
      "Drone",
      "Harbor",
      "Atlantis",
      "CI/CD",
      "Infrastructure as Code",
    ],
  },
  {
    title: "Observability & Quality",
    items: [
      "Prometheus",
      "Grafana",
      "Micrometer",
      "SonarQube",
      "k6",
      "API testing",
    ],
  },
  {
    title: "Product Engineering",
    items: [
      "Partner APIs",
      "Backend systems",
      "Real-time applications",
      "Redis",
      "React",
      "Web applications",
    ],
  },
  {
    title: "Languages & Frameworks",
    items: ["Java", "JavaScript", "C#", "SQL", "Kotlin", "SignalR"],
  },
];

export const projects: Project[] = [
  {
    title: "Affiliate Partner Integrations",
    blurb: "Accommodation API integrations for tiket.com’s partner ecosystem.",
    description:
      "Technical leadership within the Affiliate accommodation team, working closely with Product to enable partners to integrate with tiket.com through reliable APIs.",
    tech: [
      "Partner APIs",
      "Accommodation",
      "Affiliate",
      "Product collaboration",
    ],
    year: "2022 — Present",
    featured: true,
  },
  {
    title: "Cloud Platform & Reliability",
    blurb: "Engineering excellence for Traveloka’s accommodation domain.",
    description:
      "Supported AWS multi-account migration, infrastructure reviews, Lambda delivery, Elasticsearch disaster recovery, auto scaling, and cost optimization while helping product teams improve engineering quality.",
    tech: [
      "AWS",
      "Terraform",
      "AWS Lambda",
      "Elasticsearch",
      "Atlantis",
    ],
    year: "2018 — 2021",
    featured: true,
  },
  {
    title: "GitOps & Observability",
    blurb: "Delivery and monitoring foundations at LINE Indonesia.",
    description:
      "Set up Kubernetes infrastructure and GitOps workflows, enabled code quality and monitoring stacks, and owned load testing for product teams building scalable and near-real-time experiences.",
    tech: [
      "Kubernetes",
      "Argo CD",
      "Prometheus",
      "Grafana",
      "Redis",
      "k6",
    ],
    year: "2021 — 2022",
  },
  {
    title: "Open-source Developer Tools",
    blurb: "Small utilities for cloud operations and developer workflows.",
    description:
      "Public work includes a self-hosted Google Drive API utility, a Kotlin user-agent generator, AWS operational scripts, and rolling-deployment automation.",
    tech: ["Kotlin", "AWS", "Ansible", "Automation"],
    year: "2016 — Present",
    code: "https://github.com/davidasync",
  },
];

export const experience: Job[] = [
  {
    role: "Technical Lead",
    company: "tiket.com",
    companyUrl: "https://www.tiket.com",
    period: "Mar 2025 — Present",
    location: "Jakarta, Indonesia",
    points: [
      "Provide technical leadership for the Affiliate accommodation team, working closely with Product to enable partner integrations through tiket.com APIs.",
    ],
    stack: ["Partner APIs", "Accommodation", "Affiliate"],
  },
  {
    role: "Senior Software Engineer",
    company: "tiket.com",
    companyUrl: "https://www.tiket.com",
    period: "Oct 2022 — Mar 2025",
    location: "Jakarta, Indonesia",
    points: [
      "Built partner-facing integrations in the Affiliate accommodation team in close collaboration with Product.",
      "Progressed into the Technical Lead role in March 2025.",
    ],
    stack: ["API integration", "Product engineering", "Affiliate"],
  },
  {
    role: "Software Engineer",
    company: "LINE Indonesia",
    companyUrl: "https://line.me",
    period: "Oct 2021 — Aug 2022",
    location: "Jakarta, Indonesia",
    points: [
      "Built scalable products with Product and Product Design, including near-real-time experiences backed by Redis.",
      "Set up and maintained Kubernetes infrastructure and GitOps workflows using Drone, Argo CD, and Harbor.",
      "Enabled code quality, monitoring, and load testing with SonarQube, Prometheus, Grafana, Micrometer, and k6.",
    ],
    stack: ["Kubernetes", "Argo CD", "Prometheus", "Grafana", "Redis", "k6"],
  },
  {
    role: "Software Engineer",
    company: "Traveloka",
    companyUrl: "https://www.traveloka.com",
    period: "Jul 2018 — Sep 2021",
    location: "Jakarta, Indonesia",
    points: [
      "Helped drive engineering excellence for the Accommodation domain as part of a central quality team.",
      "Administered AWS accounts, reviewed Terraform changes, and supported multi-account and multi-repository initiatives.",
      "Worked on dependency monitoring, Lambda CI/CD, Elasticsearch disaster recovery, auto scaling, incident investigation, and infrastructure cost optimization.",
    ],
    stack: ["AWS", "Terraform", "Java", "AWS Lambda", "Elasticsearch"],
  },
  {
    role: "Software Engineer",
    company: "Cermati",
    companyUrl: "https://www.cermati.com",
    period: "Mar 2017 — Jun 2018",
    location: "Jakarta, Indonesia",
    points: [
      "Developed web applications that supported bank back-office operations.",
      "Contributed across design, development, documentation, testing, and operations while working with Product on technical solutions.",
    ],
    stack: ["Web applications", "Backend", "Testing", "Operations"],
  },
  {
    role: "Backend Developer",
    company: "IndoTrading",
    companyUrl: "https://www.indotrading.com",
    period: "Mar 2016 — Feb 2017",
    location: "Jakarta, Indonesia",
    points: [
      "Developed backend and frontend web applications for back-office operations and introduced React to the team.",
      "Contributed throughout the software lifecycle, from product specifications and design through delivery and operations.",
    ],
    stack: ["React", "Backend", "Frontend", "Web applications"],
  },
  {
    role: "Junior Programmer / Associated Member",
    company: "BINUS University",
    companyUrl: "https://binus.ac.id",
    period: "Mar 2014 — Feb 2016",
    location: "Jakarta, Indonesia",
    points: [
      "Built and maintained web applications for the university’s marketing platform.",
      "Earlier, designed Unity games and 3D models while collaborating with product stakeholders.",
    ],
    stack: ["Web development", "C#", "Unity 3D", "Autodesk Maya"],
  },
];

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Work", href: "#work" },
  { label: "Experience", href: "#experience" },
  { label: "Contact", href: "#contact" },
  { label: "Dev Tools", href: "/dev-tools/" },
];
