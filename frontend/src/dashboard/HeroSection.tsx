import { ArrowRight, ShieldCheck, Activity, ScanLine } from "lucide-react";

export default function HeroSection() {
  return (
    <section
      className="
dashboard-welcome
hero-section
"
    >
      <div className="hero-content">
        <div
          className="
hero-badge
"
        >
          <ShieldCheck size={16} />
          AI Health Monitoring Active
        </div>

        <h1>Protect Every Step With Intelligent Foot Care</h1>

        <p>
          DIA SCAN membantu melakukan pemantauan kesehatan kaki melalui
          analisis AI untuk mendeteksi risiko lebih awal.
        </p>

        <div
          className="
hero-actions
"
        >
          <button
            className="
button
"
          >
            <ScanLine size={18} />
            Mulai Pemeriksaan
            <ArrowRight size={18} />
          </button>

          <div
            className="
hero-status
"
          >
            <Activity size={18} />

            <div>
              <strong>AI System Ready</strong>

              <span>Model analysis available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Medical Visual */}

      <div
        className="
hero-visual
"
      >
        <div
          className="
hero-image-wrapper
"
        >
          <img
            src="/src/assets/editorial-feet.png"
            alt="Foot analysis"
            className="
hero-foot-image
"
          />

          <div
            className="
scan-effect
"
          />

          <div
            className="
analysis-card
"
          >
            <div>
              <p>Risk Score</p>

              <strong>32%</strong>
            </div>

            <div className="risk-low">Low Risk</div>
          </div>
        </div>
      </div>
    </section>
  );
}
