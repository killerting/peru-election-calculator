import { useState, useEffect, useCallback } from "react";

const fmt = (n) => Math.round(n).toLocaleString("es-PE");
const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(2) : "0.00";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function fetchLiveData() {
  const response = await fetch("/api/fetch-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (response.status === 429) throw new Error("Demasiadas solicitudes. Espera un minuto.");
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  return await response.json();
}

export default function ElectionCalculator() {
  const [candidateA, setCandidateA] = useState({ name: "Keiko Fujimori", votes: "" });
  const [candidateB, setCandidateB] = useState({ name: "Roberto Sánchez", votes: "" });
  const [pctCounted, setPctCounted] = useState("");
  const [scenarioPct, setScenarioPct] = useState(50);
  const [result, setResult] = useState(null);
  const [liveStatus, setLiveStatus] = useState("idle"); // idle | loading | success | error
  const [lastFetched, setLastFetched] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const vA = parseFloat(String(candidateA.votes).replace(/,/g, "")) || 0;
    const vB = parseFloat(String(candidateB.votes).replace(/,/g, "")) || 0;
    const counted = parseFloat(pctCounted) || 0;
    if (vA === 0 && vB === 0) { setResult(null); return; }
    const totalCounted = vA + vB;
    const leader = vA >= vB ? { name: candidateA.name, votes: vA } : { name: candidateB.name, votes: vB };
    const trailer = vA >= vB ? { name: candidateB.name, votes: vB } : { name: candidateA.name, votes: vA };
    const margin = leader.votes - trailer.votes;
    const totalValid = counted > 0 ? (totalCounted / counted) * 100 : null;
    const remaining = totalValid ? totalValid - totalCounted : null;
    const isLocked = remaining !== null && margin > remaining;
    const lockThresholdPct = totalValid ? ((totalValid - margin) / totalValid) * 100 : null;
    const trailerGains = remaining !== null ? (remaining * scenarioPct) / 100 : null;
    const leaderGains = remaining !== null ? remaining - trailerGains : null;
    const finalTrailer = remaining !== null ? trailer.votes + trailerGains : null;
    const finalLeader = remaining !== null ? leader.votes + leaderGains : null;
    const trailerWins = finalTrailer !== null && finalTrailer > finalLeader;
    setResult({
      leader, trailer, margin, totalCounted, totalValid, remaining,
      isLocked, lockThresholdPct, trailerGains, leaderGains,
      finalTrailer, finalLeader, trailerWins,
      pctA: pct(vA, totalCounted), pctB: pct(vB, totalCounted),
    });
  }, [candidateA.votes, candidateB.votes, pctCounted, scenarioPct]);

  const fetchData = useCallback(async () => {
    setLiveStatus("loading");
    try {
      const data = await fetchLiveData();
      setCandidateA(a => ({ ...a, votes: String(data.fujimori_votes) }));
      setCandidateB(b => ({ ...b, votes: String(data.sanchez_votes) }));
      setPctCounted(String(data.pct_counted));
      setLastFetched(data.last_updated || new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }));
      setLiveStatus("success");
    } catch (e) {
      setLiveStatus("error");
    }
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefresh) { setCountdown(0); return; }
    setCountdown(REFRESH_INTERVAL / 1000);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(); return REFRESH_INTERVAL / 1000; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const toggleAuto = () => setAutoRefresh(a => !a);

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: "#0a0a0f", color: "white" }}>
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(ellipse at 20% 20%, rgba(180,130,30,0.08) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 80%, rgba(30,80,180,0.08) 0%, transparent 60%)`,
        pointerEvents: "none"
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.3em", color: "#c89a30", marginBottom: "0.5rem", textTransform: "uppercase" }}>
            Perú · Segunda Vuelta 2026
          </div>
          <h1 style={{ fontSize: "clamp(1.6rem, 5vw, 2.6rem)", fontWeight: "normal", letterSpacing: "-0.02em", lineHeight: 1.1, margin: "0 0 0.5rem" }}>
            Calculadora de<br /><span style={{ color: "#c89a30" }}>Resultados Electorales</span>
          </h1>
        </div>

        {/* Live Data Bar */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "1rem 1.2rem", marginBottom: "1.5rem",
          display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: "0.2rem" }}>Datos en vivo · ONPE</div>
            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
              {liveStatus === "idle" && "Presiona actualizar para cargar datos"}
              {liveStatus === "loading" && <span style={{ color: "#c89a30" }}>⏳ Buscando datos...</span>}
              {liveStatus === "success" && <span style={{ color: "#22c55e" }}>✓ Actualizado {lastFetched && `a las ${lastFetched}`}</span>}
              {liveStatus === "error" && <span style={{ color: "#ef4444" }}>✗ Error al obtener datos</span>}
            </div>
            {autoRefresh && countdown > 0 && (
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", marginTop: "0.2rem" }}>
                Próxima actualización en {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          <button onClick={fetchData} disabled={liveStatus === "loading"} style={{
            background: "rgba(200,154,48,0.12)", border: "1px solid rgba(200,154,48,0.3)",
            color: "#c89a30", borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer",
            fontSize: "0.8rem", fontFamily: "Georgia, serif", transition: "all 0.2s",
            opacity: liveStatus === "loading" ? 0.5 : 1
          }}>
            🔄 Actualizar
          </button>

          <button onClick={toggleAuto} style={{
            background: autoRefresh ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${autoRefresh ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
            color: autoRefresh ? "#22c55e" : "rgba(255,255,255,0.4)",
            borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer",
            fontSize: "0.8rem", fontFamily: "Georgia, serif", transition: "all 0.2s"
          }}>
            {autoRefresh ? "⏸ Pausar auto" : "▶ Auto (5 min)"}
          </button>
        </div>

        {/* Input Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Candidato A", state: candidateA, setter: setCandidateA, color: "#e84040" },
            { label: "Candidato B", state: candidateB, setter: setCandidateB, color: "#4080e8" },
          ].map(({ label, state, setter, color }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "1.2rem"
            }}>
              <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: "rgba(255,255,255,0.3)", marginBottom: "0.6rem", textTransform: "uppercase" }}>{label}</div>
              <input value={state.name} onChange={e => setter(s => ({ ...s, name: e.target.value }))}
                placeholder="Nombre" style={{ ...inp, borderBottomColor: color + "88", marginBottom: "0.8rem" }} />
              <input value={state.votes} onChange={e => setter(s => ({ ...s, votes: e.target.value }))}
                placeholder="Votos válidos" style={{ ...inp, borderBottomColor: color + "88", fontFamily: "monospace", fontSize: "1.1rem" }} />
            </div>
          ))}
        </div>

        {/* % counted */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "1.2rem", marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: "rgba(255,255,255,0.3)", marginBottom: "0.6rem", textTransform: "uppercase" }}>% de actas contabilizadas</div>
          <input value={pctCounted} onChange={e => setPctCounted(e.target.value)} placeholder="Ej: 91.55"
            style={{ ...inp, fontFamily: "monospace", fontSize: "1.3rem", maxWidth: 200 }} />
        </div>

        {/* Results */}
        {result && (
          <div>
            <Section title="Situación Actual">
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
                <VoteBar name={result.leader.name} votes={result.leader.votes} pct={result.pctA > result.pctB ? result.pctA : result.pctB} color="#c89a30" isLeader />
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>vs</div>
                <VoteBar name={result.trailer.name} votes={result.trailer.votes} pct={result.pctA > result.pctB ? result.pctB : result.pctA} color="#4a90d9" isLeader={false} />
              </div>
              <div style={{ textAlign: "center", padding: "0.8rem", background: "rgba(200,154,48,0.08)", borderRadius: 8, border: "1px solid rgba(200,154,48,0.2)" }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>Ventaja de </span>
                <span style={{ color: "#c89a30", fontFamily: "monospace", fontSize: "1.1rem" }}>{fmt(result.margin)} votos</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}> a favor de {result.leader.name}</span>
              </div>
            </Section>

            {result.totalValid && (
              <Section title="¿Cuándo es matemáticamente imposible revertir?">
                <div style={{ marginBottom: "1rem" }}>
                  <Stat label="Votos totales estimados" value={fmt(result.totalValid)} />
                  <Stat label="Votos aún sin contar" value={result.remaining ? fmt(result.remaining) : "—"} />
                  <Stat label="Ventaja actual" value={fmt(result.margin)} />
                </div>
                {result.isLocked ? (
                  <Alert color="#22c55e" icon="🔒">
                    <strong>Resultado matemáticamente irreversible.</strong><br />
                    La ventaja ({fmt(result.margin)} votos) supera los votos restantes ({fmt(result.remaining)}). <strong>{result.leader.name} gana sin importar las actas pendientes.</strong>
                  </Alert>
                ) : (
                  <Alert color="#f59e0b" icon="⏳">
                    Aún no es irreversible. El umbral de bloqueo matemático se alcanza al{" "}
                    <strong style={{ color: "#f59e0b" }}>{result.lockThresholdPct?.toFixed(2)}% de actas contadas</strong>.
                    {pctCounted && <span> Faltan ~<strong>{(result.lockThresholdPct - parseFloat(pctCounted)).toFixed(2)}%</strong> más.</span>}
                  </Alert>
                )}
              </Section>
            )}

            {result.remaining !== null && (
              <Section title="Escenario: ¿Qué pasa si el segundo obtiene X% de los votos restantes?">
                <div style={{ marginBottom: "1.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                      {result.trailer.name} gana el <strong style={{ color: "white" }}>{scenarioPct}%</strong> de los votos restantes
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>{result.leader.name} gana el {100 - scenarioPct}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={scenarioPct}
                    onChange={e => setScenarioPct(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#c89a30" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <FinalCard name={result.leader.name} votes={result.finalLeader} isWinner={!result.trailerWins} color="#c89a30" />
                  <FinalCard name={result.trailer.name} votes={result.finalTrailer} isWinner={result.trailerWins} color="#4a90d9" />
                </div>
                {result.trailerWins ? (
                  <Alert color="#4a90d9" icon="🔄">Con ese reparto, <strong>{result.trailer.name} remontan y ganan</strong> por <strong>{fmt(result.finalTrailer - result.finalLeader)} votos</strong>.</Alert>
                ) : (
                  <Alert color="#c89a30" icon="✅">Con ese reparto, <strong>{result.leader.name} mantiene la ventaja</strong> y gana por <strong>{fmt(result.finalLeader - result.finalTrailer)} votos</strong>.</Alert>
                )}
                {(() => {
                  const breakeven = result.remaining > 0 ? ((result.margin / result.remaining + 1) / 2) * 100 : null;
                  if (!breakeven) return null;
                  return (
                    <div style={{ marginTop: "0.8rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                      Para remontar, {result.trailer.name} necesita al menos{" "}
                      <span style={{ color: "#4a90d9", fontFamily: "monospace" }}>{breakeven.toFixed(1)}%</span> de los votos restantes.
                      {breakeven > 100 && <span style={{ color: "#22c55e" }}> Matemáticamente imposible.</span>}
                    </div>
                  );
                })()}
              </Section>
            )}
          </div>
        )}

        {!result && liveStatus !== "loading" && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "0.9rem", padding: "3rem 0" }}>
            Presiona "Actualizar" para cargar los datos en vivo, o ingresa los valores manualmente
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "3rem", fontSize: "0.65rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
          DATOS: ONPE · CÁLCULOS PROPIOS · SOLO USO INFORMATIVO
        </div>
      </div>
    </div>
  );
}

const inp = {
  width: "100%", background: "transparent", border: "none",
  borderBottom: "2px solid rgba(200,154,48,0.3)", outline: "none",
  color: "white", fontSize: "0.95rem", padding: "4px 2px", fontFamily: "Georgia, serif",
  display: "block", marginBottom: "0.3rem"
};

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{title}</div>
      {children}
    </div>
  );
}
function VoteBar({ name, votes, pct, color, isLeader }) {
  return (
    <div style={{ textAlign: isLeader ? "right" : "left" }}>
      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.3rem" }}>{name}</div>
      <div style={{ fontFamily: "monospace", fontSize: "1.4rem", color }}>{pct}%</div>
      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{Math.round(votes).toLocaleString("es-PE")}</div>
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>{label}</span>
      <span style={{ fontFamily: "monospace", color: "white", fontSize: "0.9rem" }}>{value}</span>
    </div>
  );
}
function FinalCard({ name, votes, isWinner, color }) {
  return (
    <div style={{ padding: "1rem", borderRadius: 10, textAlign: "center", background: isWinner ? `${color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${isWinner ? color + "44" : "rgba(255,255,255,0.06)"}`, transition: "all 0.3s" }}>
      {isWinner && <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", color, marginBottom: "0.3rem", textTransform: "uppercase" }}>Ganador proyectado</div>}
      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.4rem" }}>{name}</div>
      <div style={{ fontFamily: "monospace", fontSize: "1.2rem", color: isWinner ? color : "white" }}>{Math.round(votes).toLocaleString("es-PE")}</div>
    </div>
  );
}
function Alert({ color, icon, children }) {
  return (
    <div style={{ padding: "0.9rem 1rem", borderRadius: 8, fontSize: "0.85rem", lineHeight: 1.5, background: `${color}10`, border: `1px solid ${color}33`, color: "rgba(255,255,255,0.8)" }}>
      {icon} {children}
    </div>
  );
}
