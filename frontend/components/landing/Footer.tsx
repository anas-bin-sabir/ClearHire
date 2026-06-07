import { Zap } from "lucide-react";

export default function Footer() {
  const links = {
    Product:  ["Features", "How It Works", "Security", "Pricing"],
    Developers: ["API Documentation", "SDKs", "Webhooks", "Status"],
    Company:  ["About", "Blog", "Careers", "Press"],
    Legal:    ["Terms of Service", "Privacy Policy", "Cookie Policy", "Contact"],
  };

  return (
    <footer id="footer" className="bg-navy-900 border-t border-white/5 text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Top */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="/clearhire-logo-rremoveBG.png"
                alt="CH Logo"
                className="w-8 h-8 object-contain shrink-0"
              />
              <span className="font-bold text-lg tracking-tight">ClearHire</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              AI-powered freelancer verification and intelligent team matching.
            </p>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-electric-400/20 bg-electric-400/5 text-xs text-electric-300">
              <Zap className="h-3.5 w-3.5 text-electric-300" />
              Built with AI-First Principles
            </div>
          </div>

          {/* Link groups */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
                {group}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* DB stack mention */}
        <div className="flex flex-wrap justify-center gap-4 mb-10 py-6 border-y border-white/5">
          {[
            { label: "PostgreSQL + pgvector", color: "#336791" },
            { label: "MongoDB",               color: "#00684A" },
            { label: "Neo4j",                 color: "#008CC1" },
            { label: "FastAPI",               color: "#009688" },
            { label: "Next.js 14",            color: "#ffffff" },
            { label: "Anthropic Claude",      color: "#7c3aed" },
          ].map((t) => (
            <span
              key={t.label}
              className="text-[11px] font-mono px-3 py-1 rounded-full border"
              style={{ color: t.color, borderColor: `${t.color}30`, background: `${t.color}10` }}
            >
              {t.label}
            </span>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p>© {new Date().getFullYear()} ClearHire. All rights reserved.</p>
          <div className="flex gap-6">
            {["Terms", "Privacy", "Contact"].map((l) => (
              <a key={l} href="#" className="hover:text-slate-400 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
