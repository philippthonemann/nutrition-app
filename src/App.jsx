import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const C = {
  bg: "#080808", surface: "#111", card: "#161616", border: "#222",
  accent: "#c8f135", accentDim: "#8fb520",
  protein: "#ff6b35", carbs: "#4fc3f7", fat: "#ffd54f",
  text: "#f0f0f0", muted: "#555", mutedLight: "#888",
  green: "#4ade80", red: "#f87171",
};

const DEFAULT_GOALS = {
  calories: 2600, protein: 170, carbs: 290, fat: 75,
  fiber: 30, sugar: 50, sodium: 2300, caffeine: 200, water: 2500, alcohol: 0
};

const GOAL_META = [
  { key: "calories", label: "Kalorien", unit: "kcal", color: "#c8f135", icon: "🔥" },
  { key: "protein",  label: "Protein",  unit: "g",    color: "#ff6b35", icon: "💪" },
  { key: "carbs",    label: "Carbs",    unit: "g",    color: "#4fc3f7", icon: "🌾" },
  { key: "fat",      label: "Fett",     unit: "g",    color: "#ffd54f", icon: "🥑" },
  { key: "fiber",    label: "Ballaststoffe", unit: "g", color: "#a78bfa", icon: "🥦" },
  { key: "sugar",    label: "Zucker",   unit: "g",    color: "#f472b6", icon: "🍬" },
  { key: "sodium",   label: "Natrium",  unit: "mg",   color: "#94a3b8", icon: "🧂" },
  { key: "water",    label: "Wasser",   unit: "ml",   color: "#38bdf8", icon: "💧" },
  { key: "caffeine", label: "Koffein",  unit: "mg",   color: "#d97706", icon: "☕" },
  { key: "alcohol",  label: "Alkohol",  unit: "g",    color: "#f87171", icon: "🍺" },
];

const SAMPLE_RECIPES = [
  { id: 1, name: "Overnight Oats", calories: 420, protein: 18, carbs: 65, fat: 9, tags: ["breakfast"] },
  { id: 2, name: "Chicken & Rice Bowl", calories: 610, protein: 52, carbs: 58, fat: 12, tags: ["lunch", "high-protein"] },
  { id: 3, name: "Protein Shake + Banana", calories: 310, protein: 35, carbs: 38, fat: 4, tags: ["snack"] },
  { id: 4, name: "Salmon & Süßkartoffel", calories: 520, protein: 44, carbs: 42, fat: 16, tags: ["dinner"] },
  { id: 5, name: "Greek Yogurt Bowl", calories: 280, protein: 24, carbs: 32, fat: 5, tags: ["snack"] },
  { id: 6, name: "Pasta Bolognese", calories: 680, protein: 38, carbs: 78, fat: 18, tags: ["dinner"] },
];

// Supabase helpers
const today = () => new Date().toISOString().split("T")[0];

async function loadTodayMeals() {
  const { data } = await supabase.from("meals").select("*").eq("date", today()).order("created_at");
  return data || [];
}

async function saveMeal(meal) {
  const { data } = await supabase.from("meals").insert([{
    name: meal.name, calories: meal.calories || 0,
    protein: meal.protein || 0, carbs: meal.carbs || 0, fat: meal.fat || 0,
    fiber: meal.fiber || 0, sugar: meal.sugar || 0, sodium: meal.sodium || 0,
    caffeine: meal.caffeine || 0, water: meal.water || 0, alcohol: meal.alcohol || 0,
    estimated: meal.estimated || false, date: today()
  }]).select().single();
  return data;
}

async function deleteMeal(id) {
  await supabase.from("meals").delete().eq("id", id);
}

async function loadBodyMeasurements() {
  const { data } = await supabase.from("body_measurements").select("*").order("date");
  return data || [];
}

async function saveBodyMeasurement(entry) {
  const { data } = await supabase.from("body_measurements").insert([entry]).select().single();
  return data;
}

async function loadGoals() {
  const { data } = await supabase.from("goals").select("*").order("created_at", { ascending: false }).limit(1).single();
  return data || DEFAULT_GOALS;
}

async function saveGoals(goals) {
  await supabase.from("goals").insert([goals]);
}

async function loadWeekMeals() {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const { data } = await supabase.from("meals").select("date, calories").gte("date", start.toISOString().split("T")[0]);
  return data || [];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Ring({ value, goal, color, size = 80, sw = 7 }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(value / goal, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray .6s cubic-bezier(.4,0,.2,1)" }}/>
    </svg>
  );
}

function Tag({ children }) {
  return <span style={{ background: C.surface, borderRadius: 4, padding: "2px 7px", fontSize: 10, color: C.mutedLight, marginRight: 4 }}>{children}</span>;
}

function Btn({ children, onClick, accent, full, small, disabled, style: sx = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : undefined,
      background: accent ? C.accent : C.card,
      color: accent ? "#000" : C.mutedLight,
      border: `1px solid ${accent ? "transparent" : C.border}`,
      borderRadius: small ? 8 : 12,
      padding: small ? "7px 14px" : "13px 20px",
      fontFamily: "'DM Sans', sans-serif",
      fontSize: small ? 12 : 14, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "all .15s ease",
      ...sx,
    }}>{children}</button>
  );
}

function Label({ children }) {
  return <div style={{ color: C.muted, fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

async function callClaude(system, userContent, imageBase64 = null) {
  const content = imageBase64
    ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
       { type: "text", text: userContent }]
    : userContent;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      system, messages: [{ role: "user", content }]
    })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  return text.replace(/```json|```/g, "").trim();
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function TodayTab({ logged, setLogged, goals }) {
  const totals = logged.reduce((a, m) => ({
    calories: a.calories + (m.calories || 0), protein: a.protein + (m.protein || 0),
    carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const calPct = Math.min((totals.calories / goals.calories) * 100, 100);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const filtered = SAMPLE_RECIPES.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async (recipe) => {
    setSaving(true);
    const saved = await saveMeal(recipe);
    if (saved) setLogged(p => [...p, saved]);
    setShowAdd(false); setSearch(""); setSaving(false);
  };

  const handleRemove = async (id) => {
    await deleteMeal(id);
    setLogged(p => p.filter(m => m.id !== id));
  };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* Calorie hero */}
      <div style={{ background: C.card, borderRadius: 20, padding: 20, marginBottom: 14, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Label>Kalorien heute</Label>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 54, lineHeight: 1, color: C.text }}>
              {totals.calories}<span style={{ fontSize: 18, color: C.muted, marginLeft: 4 }}>/ {goals.calories}</span>
            </div>
            <div style={{ color: C.accent, fontSize: 13, marginTop: 4 }}>
              {goals.calories - totals.calories > 0 ? `${goals.calories - totals.calories} kcal verbleibend` : "Ziel erreicht 🎯"}
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <Ring value={totals.calories} goal={goals.calories} color={C.accent} size={76} sw={7}/>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, color: C.text }}>{Math.round(calPct)}%</div>
          </div>
        </div>
        <div style={{ marginTop: 14, height: 3, background: C.border, borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${calPct}%`, background: C.accent, borderRadius: 2, transition: "width .6s ease" }}/>
        </div>
      </div>

      {/* Macros row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[["Protein", totals.protein, goals.protein, C.protein], ["Carbs", totals.carbs, goals.carbs, C.carbs], ["Fett", totals.fat, goals.fat, C.fat]].map(([l, v, g, col]) => (
          <div key={l} style={{ flex: 1, background: C.card, borderRadius: 14, padding: "14px 12px", border: `1px solid ${C.border}` }}>
            <Label>{l}</Label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: C.text }}>
                {v}<span style={{ fontSize: 12, color: C.muted }}>g</span>
              </div>
              <Ring value={v} goal={g} color={col} size={36} sw={4}/>
            </div>
            <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 8 }}>
              <div style={{ height: "100%", width: `${Math.min((v/g)*100,100)}%`, background: col, borderRadius: 2 }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Meal log */}
      <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1 }}>Mahlzeiten</div>
          <button onClick={() => setShowAdd(!showAdd)} style={{
            background: C.accent, color: "#000", border: "none", borderRadius: 8,
            width: 28, height: 28, fontSize: 20, cursor: "pointer", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>+</button>
        </div>
        {showAdd && (
          <div style={{ marginBottom: 12, animation: "fadeIn .2s ease" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rezept suchen…"
              autoFocus style={{
                width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "10px 12px", color: C.text, fontFamily: "'DM Sans',sans-serif",
                fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 6,
              }}/>
            {filtered.map(r => (
              <div key={r.id} onClick={() => !saving && handleAdd(r)}
                style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", opacity: saving ? 0.5 : 1 }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div>
                  <div style={{ fontSize: 13, color: C.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>P{r.protein} C{r.carbs} F{r.fat}</div>
                </div>
                <div style={{ color: C.accent, fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, alignSelf: "center" }}>{r.calories}</div>
              </div>
            ))}
          </div>
        )}
        {logged.length === 0
          ? <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Noch nichts geloggt</div>
          : logged.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>P {m.protein}g · C {m.carbs}g · F {m.fat}g</div>
                {m.estimated && <span style={{ fontSize: 10, color: C.accent, marginTop: 2, display: "block" }}>~ KI-Schätzung</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ color: C.accent, fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>{m.calories}</div>
                <button onClick={() => handleRemove(m.id)}
                  style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>×</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── AI SCAN TAB ───────────────────────────────────────────────────────────────
function ScanTab({ onAdd }) {
  // All inputs are always visible and combinable
  const [text, setText] = useState("");
  const [imageB64, setImageB64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [recording, setRecording] = useState(false);
  const [voiceAppended, setVoiceAppended] = useState(false);
  const fileRef = useRef();
  const recognitionRef = useRef(null);

  const activeInputs = [imageB64 && "foto", text.trim() && "text"].filter(Boolean);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const full = ev.target.result;
      setImagePreview(full);
      setImageB64(full.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const toggleVoice = () => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert("Spracherkennung wird von diesem Browser nicht unterstützt"); return; }
      const rec = new SR();
      rec.lang = "de-DE"; rec.continuous = false; rec.interimResults = false;
      rec.onresult = (e) => {
        const t = e.results[0][0].transcript;
        // Append transcript to existing text (don't overwrite)
        setText(prev => prev ? `${prev} — ${t}` : t);
        setVoiceAppended(true);
        setTimeout(() => setVoiceAppended(false), 2000);
      };
      rec.onend = () => setRecording(false);
      rec.start(); recognitionRef.current = rec;
      setRecording(true);
    }
  };

  const analyze = async () => {
    if (!text.trim() && !imageB64) return;
    setLoading(true); setResult(null);
    const sys = `Du bist Ernährungsexperte. Schätze die Nährwerte der Mahlzeit basierend auf allen verfügbaren Infos (Bild + Texthinweise).
Nutze die Texthinweise um deine Bild-Analyse zu verfeinern — z.B. wenn jemand sagt "extra Portion" oder "ca. 300g".
Antworte NUR mit JSON, kein Markdown:
{"name":"...", "calories":X, "protein":X, "carbs":X, "fat":X, "confidence":"hoch|mittel|niedrig", "note":"kurze Erklärung was du berücksichtigt hast", "inputs":"was du analysiert hast (Foto/Text/beides)"}`;
    const userPrompt = text.trim()
      ? `Zusätzliche Hinweise vom Nutzer: "${text.trim()}"\n\nSchätze die Nährwerte möglichst genau.`
      : "Schätze die Nährwerte dieser Mahlzeit.";
    try {
      const raw = await callClaude(sys, userPrompt, imageB64 || null);
      setResult(JSON.parse(raw));
    } catch {
      setResult({ name: "Fehler", calories: 0, protein: 0, carbs: 0, fat: 0, note: "Analyse fehlgeschlagen – bitte nochmal versuchen." });
    }
    setLoading(false);
  };

  const reset = () => {
    setResult(null); setText(""); setImageB64(null); setImagePreview(null);
  };

  const confidenceColor = { hoch: C.green, mittel: C.fat, niedrig: C.red };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1, marginBottom: 2 }}>
        KI<span style={{ color: C.accent }}>-Scan</span>
      </div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
        Kombiniere Foto + Text + Sprache für bessere Genauigkeit
      </div>

      {/* ── INPUT BLOCK 1: Foto ── */}
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${imageB64 ? C.accent : C.border}`, marginBottom: 12, overflow: "hidden", transition: "border-color .2s" }}>
        <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📷</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Foto</div>
              <div style={{ fontSize: 11, color: C.muted }}>Mahlzeit, Verpackung, Menü</div>
            </div>
          </div>
          {imageB64
            ? <button onClick={() => { setImageB64(null); setImagePreview(null); }} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.mutedLight, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>Entfernen</button>
            : <button onClick={() => fileRef.current.click()} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Foto</button>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleImage}/>
        {imagePreview && (
          <div style={{ padding: "0 14px 14px" }}>
            <img src={imagePreview} alt="food" style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "cover" }}/>
          </div>
        )}
        {!imagePreview && (
          <div onClick={() => fileRef.current.click()} style={{
            margin: "0 14px 14px", border: `1.5px dashed ${C.border}`, borderRadius: 10,
            padding: "22px 0", textAlign: "center", cursor: "pointer",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div style={{ color: C.muted, fontSize: 13 }}>Tippen zum Hochladen</div>
          </div>
        )}
      </div>

      {/* ── INPUT BLOCK 2: Text + Voice kombiniert ── */}
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${text.trim() ? C.accent : C.border}`, marginBottom: 12, transition: "border-color .2s" }}>
        <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Beschreibung</div>
              <div style={{ fontSize: 11, color: C.muted }}>Text eingeben oder Sprache anhängen</div>
            </div>
          </div>
          {/* Voice button — appends to text */}
          <button onClick={toggleVoice} style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `1.5px solid ${recording ? C.red : voiceAppended ? C.green : C.border}`,
            background: recording ? `${C.red}20` : voiceAppended ? `${C.green}20` : C.surface,
            color: recording ? C.red : voiceAppended ? C.green : C.mutedLight,
            fontSize: 16, cursor: "pointer",
            animation: recording ? "pulse 1.2s ease infinite" : "none",
            transition: "all .2s ease", display: "flex", alignItems: "center", justifyContent: "center",
          }}>🎙️</button>
        </div>
        {recording && (
          <div style={{ margin: "0 14px 10px", background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red, animation: "pulse 1s ease infinite" }}/>
            <span style={{ color: C.red, fontSize: 12 }}>Aufnahme läuft — tippe 🎙️ zum Stoppen</span>
          </div>
        )}
        {voiceAppended && !recording && (
          <div style={{ margin: "0 14px 10px", background: `${C.green}15`, borderRadius: 8, padding: "6px 12px" }}>
            <span style={{ color: C.green, fontSize: 12 }}>✓ Sprache zum Text hinzugefügt</span>
          </div>
        )}
        <div style={{ padding: "0 14px 14px" }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={imageB64
              ? "z.B. 'extra große Portion', 'ca. 400g', 'mit viel Öl gebraten', 'vegetarisch'…"
              : "z.B. 'Döner mit Fladenbrot, extra Fleisch' oder '200g Hähnchen mit Reis und Brokkoli'"}
            rows={3}
            style={{
              width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: 12, color: C.text, fontFamily: "'DM Sans',sans-serif", fontSize: 14,
              outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6,
            }}
          />
          {text.trim() && (
            <button onClick={() => setText("")} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", padding: "4px 0" }}>
              Text löschen ×
            </button>
          )}
        </div>
      </div>

      {/* ── Active inputs indicator ── */}
      {activeInputs.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.muted }}>Analysiert wird:</span>
          {imageB64 && <span style={{ background: `${C.accent}20`, color: C.accent, fontSize: 11, borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}>📷 Foto</span>}
          {text.trim() && <span style={{ background: `${C.carbs}20`, color: C.carbs, fontSize: 11, borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}>✏️ Text</span>}
          {activeInputs.length === 2 && <span style={{ color: C.green, fontSize: 11, fontWeight: 600 }}>→ Kombination = genauer</span>}
        </div>
      )}

      {/* ── Analyze button ── */}
      <Btn full accent onClick={analyze} disabled={loading || (!text.trim() && !imageB64)}
        style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, marginBottom: 16 }}>
        {loading ? "KI analysiert…" : "Nährwerte schätzen"}
      </Btn>

      {/* ── Result ── */}
      {result && (
        <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, animation: "fadeIn .4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: C.text, flex: 1, paddingRight: 10 }}>{result.name}</div>
            {result.confidence && (
              <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", flexShrink: 0,
                color: confidenceColor[result.confidence] || C.muted,
                border: `1px solid ${confidenceColor[result.confidence] || C.muted}`,
                borderRadius: 6, padding: "3px 8px" }}>
                {result.confidence}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["kcal", result.calories, C.accent], ["Protein", result.protein + "g", C.protein],
              ["Carbs", result.carbs + "g", C.carbs], ["Fett", result.fat + "g", C.fat]].map(([l, v, col]) => (
              <div key={l} style={{ flex: 1, background: C.surface, borderRadius: 10, padding: "10px 0", textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: col }}>{v}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          {result.note && (
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 14, borderLeft: `2px solid ${C.accent}`, paddingLeft: 10 }}>
              {result.note}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full accent onClick={() => { onAdd({ ...result, id: Date.now(), estimated: true }); reset(); }}>
              Zum Log →
            </Btn>
            <Btn onClick={reset} style={{ flexShrink: 0 }}>Neu</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BODY TAB ──────────────────────────────────────────────────────────────────
function BodyTab() {
  const [history, setHistory] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadBodyMeasurements().then(data => {
      setHistory(data);
      setLoadingData(false);
    });
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ weight: "", waist: "", chest: "", hip: "" });
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeMetric, setActiveMetric] = useState("weight");

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const delta = (key) => latest && prev ? (latest[key] - prev[key]).toFixed(1) : null;

  const addEntry = async () => {
    const entry = { date: new Date().toISOString().split("T")[0], ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, parseFloat(v) || 0])) };
    const saved = await saveBodyMeasurement(entry);
    if (saved) setHistory(p => [...p, saved]);
    setForm({ weight: "", waist: "", chest: "", hip: "" });
    setShowForm(false);
  };

  const getAnalysis = async () => {
    setAnalyzing(true); setAnalysis(null);
    const sys = `Du bist Personal Trainer und Ernährungsberater. Analysiere die Körperdaten und gib konkrete Empfehlungen.
Antworte NUR mit JSON:
{"trend":"positiv|neutral|negativ", "summary":"2-3 Sätze Gesamtbewertung", "recommendations":["Tipp 1","Tipp 2","Tipp 3"], "calorieAdjustment":"erhöhen|beibehalten|reduzieren", "calorieReason":"kurze Begründung"}`;
    try {
      const raw = await callClaude(sys,
        `Körperdaten der letzten Monate: ${JSON.stringify(history)}
Aktuelle Tageskalorien: 2400 kcal, Protein-Ziel: 160g.
Analysiere Trend und gib Empfehlungen.`);
      setAnalysis(JSON.parse(raw));
    } catch { setAnalysis({ trend: "neutral", summary: "Analyse nicht verfügbar.", recommendations: [], calorieAdjustment: "beibehalten" }); }
    setAnalyzing(false);
  };

  const metrics = [
    { key: "weight", label: "Gewicht", unit: "kg", color: C.accent },
    { key: "waist", label: "Bauch", unit: "cm", color: C.protein },
    { key: "chest", label: "Brust", unit: "cm", color: C.carbs },
    { key: "hip", label: "Hüfte", unit: "cm", color: C.fat },
  ];

  // mini sparkline
  const SparkLine = ({ metricKey, color }) => {
    const vals = history.map(h => h[metricKey]).filter(Boolean);
    if (vals.length < 2) return null;
    const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
    const W = 120, H = 36;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(" ");
    return (
      <svg width={W} height={H}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        {vals.map((v, i) => (
          <circle key={i} cx={(i / (vals.length - 1)) * W} cy={H - ((v - min) / range) * (H - 4) - 2}
            r={i === vals.length - 1 ? 4 : 2} fill={i === vals.length - 1 ? color : "none"} stroke={color} strokeWidth={1.5}/>
        ))}
      </svg>
    );
  };

  const trendColor = { positiv: C.green, neutral: C.fat, negativ: C.red };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1 }}>
            Körper<span style={{ color: C.accent }}>-Tracking</span>
          </div>
          <div style={{ color: C.muted, fontSize: 12 }}>{history.length} Messungen</div>
        </div>
        <Btn small onClick={() => setShowForm(!showForm)}>+ Messung</Btn>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {metrics.map(m => {
          const d = delta(m.key);
          const isDown = parseFloat(d) < 0;
          const isGoodDown = m.key === "weight" || m.key === "waist" || m.key === "hip";
          const positive = (isGoodDown && isDown) || (!isGoodDown && !isDown);
          return (
            <div key={m.key} onClick={() => setActiveMetric(m.key)} style={{
              flex: "1 1 calc(50% - 5px)", background: activeMetric === m.key ? `${m.color}12` : C.card,
              borderRadius: 14, padding: "14px 14px 10px", border: `1px solid ${activeMetric === m.key ? m.color : C.border}`,
              cursor: "pointer", transition: "all .15s ease",
            }}>
              <Label>{m.label}</Label>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: C.text }}>
                {latest?.[m.key]}<span style={{ fontSize: 13, color: C.muted, marginLeft: 2 }}>{m.unit}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                {d !== null && (
                  <span style={{ fontSize: 12, color: positive ? C.green : C.red }}>
                    {parseFloat(d) > 0 ? "+" : ""}{d}{m.unit}
                  </span>
                )}
                <SparkLine metricKey={m.key} color={m.color}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14, animation: "fadeIn .2s ease" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>Neue Messung</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {metrics.map(m => (
              <div key={m.key}>
                <Label>{m.label} ({m.unit})</Label>
                <input type="number" step="0.1" value={form[m.key]} onChange={e => setForm(p => ({ ...p, [m.key]: e.target.value }))}
                  placeholder={`${latest?.[m.key] || "—"}`} style={{
                    width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: "10px 12px", color: C.text, fontFamily: "'DM Sans',sans-serif", fontSize: 14,
                    outline: "none", boxSizing: "border-box",
                  }}/>
              </div>
            ))}
          </div>
          <Btn full accent onClick={addEntry}>Speichern</Btn>
        </div>
      )}

      {/* History table */}
      <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 12 }}>Verlauf</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Datum", "Gewicht", "Bauch", "Brust", "Hüfte"].map(h => (
                <th key={h} style={{ color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1,
                  textAlign: "left", padding: "4px 8px 10px 0", fontWeight: 400, textTransform: "uppercase" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[...history].reverse().map((e, i) => (
                <tr key={e.date} style={{ opacity: i === 0 ? 1 : 0.7 }}>
                  <td style={{ padding: "8px 8px 8px 0", color: i === 0 ? C.accent : C.mutedLight, fontSize: 12 }}>{e.date.slice(5)}</td>
                  {["weight", "waist", "chest", "hip"].map(k => (
                    <td key={k} style={{ padding: "8px 8px 8px 0", color: C.text }}>{e[k]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Analysis */}
      <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1 }}>KI-Analyse</div>
          <div style={{ background: C.accent, color: "#000", fontSize: 10, fontFamily: "'DM Mono',monospace", padding: "3px 8px", borderRadius: 20, fontWeight: 700 }}>AI</div>
        </div>
        {analysis ? (
          <div style={{ animation: "fadeIn .4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: trendColor[analysis.trend] || C.muted }}/>
              <span style={{ color: trendColor[analysis.trend], fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{analysis.trend}</span>
            </div>
            <div style={{ color: C.mutedLight, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{analysis.summary}</div>
            {analysis.recommendations?.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ color: C.accent, fontSize: 16, lineHeight: 1 }}>→</span>
                <span style={{ color: C.text, fontSize: 13 }}>{r}</span>
              </div>
            ))}
            {analysis.calorieAdjustment && (
              <div style={{ marginTop: 14, background: C.surface, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: 1, marginBottom: 4 }}>KALORIEN-EMPFEHLUNG</div>
                <div style={{ color: analysis.calorieAdjustment === "erhöhen" ? C.green : analysis.calorieAdjustment === "reduzieren" ? C.red : C.fat, fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1 }}>
                  {analysis.calorieAdjustment.toUpperCase()}
                </div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{analysis.calorieReason}</div>
              </div>
            )}
            <button onClick={getAnalysis} style={{ marginTop: 14, background: "none", border: `1px solid ${C.border}`, color: C.mutedLight, width: "100%", padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
              Neu analysieren →
            </button>
          </div>
        ) : (
          <div>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
              Analysiere deinen Fortschritt — erhalte personalisierte Empfehlungen für Kalorien, Makros und Training.
            </div>
            <Btn full accent onClick={getAnalysis} disabled={analyzing}
              style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2 }}>
              {analyzing ? "Analysiere…" : "Analyse starten"}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WEEK TAB ──────────────────────────────────────────────────────────────────
function WeekTab({ goals }) {
  const [weekData, setWeekData] = useState([]);

  useEffect(() => {
    loadWeekMeals().then(meals => {
      const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
      const todayIdx = (new Date().getDay() + 6) % 7;
      const result = days.map((day, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (todayIdx - i));
        const dateStr = date.toISOString().split("T")[0];
        const cal = meals.filter(m => m.date === dateStr).reduce((a, m) => a + (m.calories || 0), 0);
        return { day, cal, today: i === todayIdx };
      });
      setWeekData(result);
    });
  }, []);

  const avgCal = weekData.length ? Math.round(weekData.filter(d => d.cal > 0).reduce((a, d) => a + d.cal, 0) / Math.max(weekData.filter(d => d.cal > 0).length, 1)) : 0;

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 16 }}>Wochenübersicht</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          {weekData.map(d => {
            const pct = Math.min((d.cal / goals.calories) * 100, 100);
            return (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ color: d.today ? C.accent : C.muted, fontSize: 10, fontFamily: "'DM Mono',monospace" }}>{d.cal || "–"}</div>
                <div style={{ width: "100%", height: 80, background: C.border, borderRadius: 4, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                  <div style={{ width: "100%", height: `${pct}%`, background: d.today ? C.accent : d.cal > goals.calories ? C.protein : "#2a2a2a", borderRadius: "4px 4px 0 0", transition: "height .5s ease", minHeight: d.cal > 0 ? 4 : 0 }}/>
                </div>
                <div style={{ color: d.today ? C.accent : C.muted, fontSize: 11, fontWeight: d.today ? 700 : 400 }}>{d.day}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1, marginBottom: 16 }}>Ø Wochenschnitt</div>
        {[["Kalorien", avgCal, goals.calories, C.accent, "kcal"]].map(([l, v, g, c, u]) => (
          <div key={l} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: C.mutedLight }}>{l}</span>
              <span style={{ fontSize: 13, color: C.text }}>{v}{u} <span style={{ color: C.muted }}>/ {g}{u}</span></span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${Math.min((v/g)*100,100)}%`, background: c, borderRadius: 2 }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [logged, setLogged] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  const dateStr = new Date().toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" }).toUpperCase();

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap";
    link.rel = "stylesheet"; document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
      html, body { background: #080808; overflow-x: hidden; max-width: 100vw; }
      body { overscroll-behavior: none; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,.4); } 50% { box-shadow: 0 0 0 12px rgba(248,113,113,0); } }
      input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      #root { background: #080808; min-height: 100vh; }
    `;
    document.head.appendChild(style);

    // Load data from Supabase
    Promise.all([loadTodayMeals(), loadGoals()]).then(([meals, g]) => {
      setLogged(meals);
      setGoals(g);
      setLoading(false);
    });
  }, []);

  const handleAddFromScan = async (meal) => {
    const saved = await saveMeal(meal);
    if (saved) setLogged(p => [...p, saved]);
    setTab("today");
  };

  const navItems = [
    { key: "today", icon: "◉", label: "Heute" },
    { key: "scan", icon: "⬡", label: "Scan" },
    { key: "body", icon: "◈", label: "Körper" },
    { key: "week", icon: "▦", label: "Woche" },
  ];

  if (loading) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: C.accent, letterSpacing: 2 }}>Nutrition</div>
      <div style={{ color: C.muted, fontSize: 13 }}>Daten werden geladen…</div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans',sans-serif", maxWidth: 430, margin: "0 auto", paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: "44px 20px 16px" }}>
        <div style={{ color: C.muted, fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>{dateStr}</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2, marginTop: 2 }}>
          Philipp's <span style={{ color: C.accent }}>Nutrition</span>
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        {tab === "today" && <TodayTab logged={logged} setLogged={setLogged} goals={goals}/>}
        {tab === "scan" && <ScanTab onAdd={handleAddFromScan}/>}
        {tab === "body" && <BodyTab/>}
        {tab === "week" && <WeekTab goals={goals}/>}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", padding: "12px 0 28px", zIndex: 100 }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 430, margin: "0 auto" }}>
        {navItems.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: tab === t.key ? C.accent : C.muted, transition: "color .15s ease" }}>
            <span style={{ fontSize: tab === t.key ? 22 : 18, transition: "font-size .15s ease" }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>{t.label}</span>
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
