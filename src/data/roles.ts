import type { Role, RoleId } from '../domain/types';

export const ROLES: readonly Role[] = [
  { id: 'ios', name: 'iOS Engineer', description: 'Builds native apps for iPhone, iPad, watchOS, tvOS.' },
  { id: 'android', name: 'Android Engineer', description: 'Builds native Android apps for phones, tablets, wearables.' },
  { id: 'frontend', name: 'Frontend Web Engineer', description: 'Builds browser-side web UIs and interactions.' },
  { id: 'backend', name: 'Backend Engineer', description: 'Builds servers, APIs, business logic, persistence.' },
  { id: 'fullstack', name: 'Full-Stack Engineer', description: 'Spans browser, server, and database layers.' },
  { id: 'devops', name: 'DevOps / SRE', description: 'Operates production systems, CI/CD, reliability.' },
  { id: 'platform', name: 'Platform Engineer', description: 'Builds internal developer platforms and abstractions.' },
  { id: 'cloud', name: 'Cloud Engineer', description: 'Designs and runs cloud infrastructure (AWS/GCP/Azure).' },
  { id: 'data-eng', name: 'Data Engineer', description: 'Builds pipelines, warehouses, ETL/ELT.' },
  { id: 'ml', name: 'ML / AI Engineer', description: 'Trains, deploys, and serves ML and LLM systems.' },
  { id: 'embedded', name: 'Embedded / Firmware', description: 'Writes software for microcontrollers and constrained devices.' },
  { id: 'game', name: 'Game Developer', description: 'Builds games and real-time interactive software.' },
  { id: 'security', name: 'Security Engineer', description: 'AppSec, infra security, threat modeling, red/blue team.' },
  { id: 'qa', name: 'QA / Test Engineer', description: 'Designs test strategy, automation, and quality gates.' },
  { id: 'dba', name: 'Database Engineer / DBA', description: 'Tunes, models, replicates, and operates databases.' },
  { id: 'systems', name: 'Systems / Kernel Engineer', description: 'Operating systems, drivers, low-level performance.' },
  { id: 'em', name: 'Engineering Manager', description: 'Leads people, delivery, hiring, and process.' },
  { id: 'staff', name: 'Staff / Tech Lead', description: 'Sets technical direction across teams.' },
  { id: 'arch', name: 'Solutions Architect', description: 'Designs end-to-end systems and integrations.' },
  { id: 'devrel', name: 'Developer Relations', description: 'Bridges engineering and external developers.' },
  { id: 'xr', name: 'AR / VR / XR Engineer', description: 'Builds immersive 3D experiences and spatial apps.' },
  { id: 'blockchain', name: 'Blockchain Engineer', description: 'Smart contracts, protocols, and on-chain systems.' },
  // Phase 1 additions.
  { id: 'sre', name: 'Site Reliability Engineer', description: 'Owns reliability, error budgets, toil reduction, and incident response.' },
  { id: 'mlops', name: 'MLOps Engineer', description: 'Deploys, serves, and monitors ML models in production.' },
  { id: 'ai-app', name: 'AI Application Engineer', description: 'Builds product features on LLM APIs — RAG, agents, evals.' },
  { id: 'data-sci', name: 'Data Scientist', description: 'Statistical analysis, experimentation, and applied modeling.' },
  { id: 'analytics-eng', name: 'Analytics Engineer', description: 'Models warehouse data and ships the semantic layer (dbt-era).' },
  { id: 'product-eng', name: 'Product Engineer', description: 'Full-stack with strong product sense; ships end-to-end features.' },
  { id: 'dx', name: 'Developer Experience Engineer', description: 'Internal tooling, CLIs, IDE integrations, and onboarding.' },
  { id: 'growth', name: 'Growth Engineer', description: 'A/B testing, funnels, instrumentation, and conversion work.' },
  { id: 'design-eng', name: 'Design Engineer', description: 'Bridges design and frontend — design systems, motion, polish.' },
  { id: 'dist-sys', name: 'Distributed Systems Engineer', description: 'Consensus, replication, sharding, and fault-tolerant systems.' },
  { id: 'perf', name: 'Performance Engineer', description: 'Profiling, optimization, and latency work across the stack.' },
  { id: 'obs', name: 'Observability Engineer', description: 'Telemetry, tracing, metrics, and SLO design.' },
  { id: 'privacy', name: 'Privacy Engineer', description: 'GDPR/CCPA, data minimization, and user-data lifecycle.' },
  { id: 'a11y', name: 'Accessibility Engineer', description: 'WCAG conformance, assistive tech, and inclusive UX engineering.' },
] as const;

export const ALL_ROLE_IDS: readonly RoleId[] = ROLES.map((r) => r.id);

export function roleById(id: RoleId): Role | undefined {
  return ROLES.find((r) => r.id === id);
}
