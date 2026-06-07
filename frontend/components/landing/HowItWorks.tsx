"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, Network, Brain } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: ClipboardList,
    title: "Project Input",
    subtitle: "Define your constraints",
    desc: "You describe your project: required skills, budget ceiling, deadline, and team size. ClearHire stores this in PostgreSQL and generates a 384-dimension semantic embedding of your description.",
    db: "PostgreSQL",
    dbColor: "#336791",
    code: `POST /api/projects
{
  "title": "Backend API Dev",
  "skills": ["Python","FastAPI"],
  "budget": 5000,
  "deadline_days": 30
}`,
  },
  {
    num: "02",
    icon: Network,
    title: "Knowledge Graph Traversal",
    subtitle: "AI maps skills to needs",
    desc: "Neo4j traverses the skill ontology — a job requiring React also surfaces Next.js and TypeScript developers via 2-hop graph traversal. pgvector finds the 20 most semantically similar profiles in O(√N) time.",
    db: "Neo4j + pgvector",
    dbColor: "#008CC1",
    code: `MATCH (f)-[:HAS_SKILL]->(s)
WHERE s.name = 'React'
   OR (s)-[:RELATED_TO*1..2]->
      (:Skill {name:'React'})
RETURN DISTINCT f.id, f.name`,
  },
  {
    num: "03",
    icon: Brain,
    title: "AI Reasoning",
    subtitle: "LLM explains the best fit",
    desc: "The A* search engine re-ranks candidates by combining skill gap, fraud score, and rate deviation. The Anthropic Claude API generates a natural-language justification for every recommendation.",
    db: "Claude API",
    dbColor: "#7c3aed",
    code: `f(n) = g(n) + h(n)
g(n) = 0.4·skill_gap
     + 0.3·fraud_penalty
     + 0.2·rate_deviation
h(n) = 0.1·(1 - cosine_sim)`,
  },
];

export default function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Animate the line
          let h = 0;
          const maxH = el.offsetHeight - 64;
          const iv = setInterval(() => {
            h += 6;
            setLineHeight(Math.min(h, maxH));
            if (h >= maxH) clearInterval(iv);
          }, 12);

          // Stagger step reveals
          steps.forEach((_, i) => {
            setTimeout(() => setActiveStep(i), i * 600 + 200);
          });
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="py-28 bg-white dark:bg-navy-900 transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-20">
          <span className="inline-block px-3 py-1 text-xs font-mono uppercase tracking-widest text-violet bg-violet/10 rounded-full border border-violet/20 mb-4">
            Under the Hood
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-navy-900 dark:text-white mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            From project description to verified team — in under 3 seconds.
          </p>
        </div>

        {/* Timeline */}
        <div ref={containerRef} className="relative">
          {/* Animated vertical line */}
          <div className="absolute left-8 top-8 w-0.5 bg-slate-100 dark:bg-white/5" style={{ height: "calc(100% - 64px)" }}>
            <div
              className="timeline-line w-full rounded-full"
              style={{ height: lineHeight }}
            />
          </div>

          <div className="flex flex-col gap-12">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`relative flex gap-8 transition-all duration-700 ${
                  activeStep >= i ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                }`}
              >
                {/* Circle node */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl transition-all duration-500 ${
                      activeStep >= i
                        ? "border-electric-400 bg-electric-400/10 scale-100"
                        : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-800 scale-90"
                    }`}
                  >
                    <step.icon className={`h-7 w-7 transition-colors ${activeStep >= i ? "text-electric-400" : "text-slate-400 dark:text-slate-500"}`} />
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-[10px] font-mono font-bold text-electric-400 bg-white dark:bg-navy-900 px-1 rounded">
                    {step.num}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 grid md:grid-cols-2 gap-6 pb-4">
                  <div>
                    <span
                      className="inline-block text-[10px] font-mono px-2 py-0.5 rounded mb-2 uppercase tracking-wider"
                      style={{
                        color: step.dbColor,
                        background: `${step.dbColor}15`,
                        border: `1px solid ${step.dbColor}40`,
                      }}
                    >
                      {step.db}
                    </span>
                    <h3 className="text-2xl font-bold text-navy-900 dark:text-white mb-1">{step.title}</h3>
                    <p className="text-sm font-medium text-electric-400 mb-3">{step.subtitle}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>

                  {/* Code snippet */}
                  <div className="bg-navy-900 dark:bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-1.5 mb-3">
                      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                        <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                    <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {step.code}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
