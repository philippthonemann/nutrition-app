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

const SAMPLE_RECIPES = [];

async function loadNotionRecipes() {
  try {
    const res = await fetch('/api/notion');
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// Supabase helpers
const today = () => new Date().toISOString().split("T")[0];

async function loadTodayMeals(date = null) {
  const d = date || today();
  const { data } = await supabase.from("meals").select("*").eq("date", d).order("created_at");
  return data || [];
}

async function saveMeal(meal) {
  const { data } = await supabase.from("meals").insert([{
    name: meal.name, calories: meal.calories || 0,
    protein: meal.protein || 0, carbs: meal.carbs || 0, fat: meal.fat || 0,
    fiber: meal.fiber || 0, sugar: meal.sugar || 0, sodium: meal.sodium || 0,
    caffeine: meal.caffeine || 0, water: meal.water || 0, alcohol: meal.alcohol || 0,
    estimated: meal.estimated || false, date: meal.date || today()
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

async function loadMonthMeals(year, month) {
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const end = new Date(year, month, 0).toISOString().split("T")[0];
  const { data } = await supabase.from("meals").select("date, calories, protein, carbs, fat").gte("date", start).lte("date", end);
  return data || [];
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
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5", max_tokens: 4000,
      system, messages: [{ role: "user", content }]
    })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  return text.replace(/```json|```/g, "").trim();
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function TodayTab({ logged, setLogged, goals, onOpenScan, selectedDate, setSelectedDate }) {
  const totals = logged.reduce((a, m) => ({
    calories: a.calories + (m.calories || 0), protein: a.protein + (m.protein || 0),
    carbs: a.carbs + (m.carbs || 0), fat: a.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const calPct = Math.min((totals.calories / goals.calories) * 100, 100);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const t = new Date(today() + "T00:00:00");
    const diff = Math.round((t - d) / 86400000);
    if (diff === 0) return "Heute";
    if (diff === 1) return "Gestern";
    return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  };

  const changeDate = (days) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split("T")[0];
    if (newDate <= today()) setSelectedDate(newDate);
  };

  const isToday = selectedDate === today();

  const handleAdd = async (recipe) => {
    setSaving(true);
    const saved = await saveMeal({ ...recipe, date: selectedDate });
    if (saved) setLogged(p => [...p, saved]);
    setSaving(false);
  };

  const handleRemove = async (id) => {
    await deleteMeal(id);
    setLogged(p => p.filter(m => m.id !== id));
  };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* Date Navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: C.card, borderRadius: 14, padding: "10px 16px", border: `1px solid ${C.border}` }}>
        <button onClick={() => changeDate(-1)} style={{ background: "none", border: "none", color: C.mutedLight, cursor: "pointer", fontSize: 20, padding: "0 8px" }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: isToday ? C.accent : C.text, letterSpacing: 1 }}>{formatDate(selectedDate)}</div>
          {!isToday && <div style={{ fontSize: 11, color: C.muted }}>{selectedDate}</div>}
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday} style={{ background: "none", border: "none", color: isToday ? C.border : C.mutedLight, cursor: isToday ? "default" : "pointer", fontSize: 20, padding: "0 8px" }}>›</button>
      </div>
      {/* Calorie hero */}
      <div style={{ background: C.card, borderRadius: 20, padding: 20, marginBottom: 14, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Label>Kalorien heute</Label>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 54, lineHeight: 1, color: C.text }}>
              {totals.calories}<span style={{ fontSize: 18, color: C.muted, marginLeft: 4 }}>/ {goals.calories}</span>
            </div>
            <div style={{ color: totals.calories > goals.calories ? C.red : C.accent, fontSize: 13, marginTop: 4 }}>
              {totals.calories > goals.calories 
                ? `+${totals.calories - goals.calories} kcal über Ziel ⚠️`
                : goals.calories - totals.calories > 0 
                  ? `${goals.calories - totals.calories} kcal verbleibend` 
                  : "Ziel erreicht 🎯"}
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <Ring value={totals.calories} goal={goals.calories} color={totals.calories > goals.calories ? C.red : C.accent} size={76} sw={7}/>
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
              <div style={{ height: "100%", width: `${Math.min((v/g)*100,100)}%`, background: v > g ? C.red : col, borderRadius: 2 }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Meal log */}
      <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1 }}>Mahlzeiten</div>
          <button onClick={onOpenScan} style={{
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
            {loadingRecipes && <div style={{ color: "#555", fontSize: 13, padding: "10px 0", textAlign: "center" }}>Lade Rezepte aus Notion…</div>}
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
  const [mode, setMode] = useState(null); // "ai"|"notion"|"manual"
  const [scanDate, setScanDate] = useState(today());
  const [text, setText] = useState("");
  const [imageB64, setImageB64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [recording, setRecording] = useState(false);
  const [voiceAppended, setVoiceAppended] = useState(false);
  // Notion mode
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeNote, setRecipeNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  // Manual mode
  const [manual, setManual] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const fileRef = useRef();
  const recognitionRef = useRef(null);

  const switchMode = (m) => {
    setMode(m); setResult(null); setText(""); setImageB64(null); setImagePreview(null);
    setSelectedRecipe(null); setRecipeNote("");
    if (m === "notion" && recipes.length === 0) {
      setLoadingRecipes(true);
      loadNotionRecipes().then(data => { setRecipes(data); setLoadingRecipes(false); });
    }
  };

  const handleImage = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImagePreview(ev.target.result); setImageB64(ev.target.result.split(",")[1]); };
    reader.readAsDataURL(file);
  };

  const toggleVoice = () => {
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Nutze das Mikrofon auf der iOS Tastatur"); return; }
    const rec = new SR(); rec.lang = "de-DE"; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setText(prev => prev ? prev + " — " + t : t); setVoiceAppended(true); setTimeout(() => setVoiceAppended(false), 2000); };
    rec.onend = () => setRecording(false); rec.start(); recognitionRef.current = rec; setRecording(true);
  };

  const analyzeAI = async () => {
    if (!text.trim() && !imageB64) return;
    setLoading(true); setResult(null);
    const sys = `Du bist Ernährungsexperte. Schätze die Nährwerte der Mahlzeit basierend auf allen verfügbaren Infos.
Antworte NUR mit JSON: {"name":"...","calories":X,"protein":X,"carbs":X,"fat":X,"confidence":"hoch|mittel|niedrig","note":"..."}`;
    try {
      const raw = await callClaude(sys, text.trim() || "Schätze die Nährwerte.", imageB64);
      
      setResult(JSON.parse(raw));
    } catch(e) { console.error("Scan error:", e, e.message); setResult({ name: "Fehler", calories: 0, protein: 0, carbs: 0, fat: 0, note: e.message || "Analyse fehlgeschlagen" }); }
    setLoading(false);
  };

  const adjustRecipe = async () => {
    if (!selectedRecipe) return;
    if (!recipeNote.trim()) { onAdd({ ...selectedRecipe, id: Date.now(), estimated: false, date: scanDate }); return; }
    setAdjusting(true);
    const sys = `Du bist Ernährungsexperte. Passe die Nährwerte eines Rezepts basierend auf dem Hinweis an.
Antworte NUR mit JSON: {"name":"...","calories":X,"protein":X,"carbs":X,"fat":X,"note":"..."}`;
    const prompt = `Rezept: ${selectedRecipe.name}
Original Nährwerte: ${selectedRecipe.calories} kcal, ${selectedRecipe.protein}g Protein, ${selectedRecipe.carbs}g Carbs, ${selectedRecipe.fat}g Fett
Hinweis: ${recipeNote}
Passe die Nährwerte entsprechend an.`;
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, system: sys, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === 'text')?.text || '';
      const adjusted = JSON.parse(text.replace(/```json|```/g, '').trim());
      onAdd({ ...selectedRecipe, ...adjusted, id: Date.now(), estimated: true, date: scanDate });
    } catch { onAdd({ ...selectedRecipe, id: Date.now(), estimated: false, date: scanDate }); }
    setAdjusting(false);
  };

  const confidenceColor = { hoch: C.green, mittel: C.fat, niedrig: C.red };
  const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1, marginBottom: 4 }}>
        Mahlzeit <span style={{ color: C.accent }}>hinzufügen</span>
      </div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Wähle wie du einloggen möchtest</div>

      {/* Date selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["Heute", today()], ["Gestern", new Date(Date.now()-86400000).toISOString().split("T")[0]]].map(([label, date]) => (
          <button key={label} onClick={() => setScanDate(date)} style={{
            padding: "8px 16px", borderRadius: 10, border: `1px solid ${scanDate === date ? C.accent : C.border}`,
            background: scanDate === date ? `${C.accent}15` : C.card,
            color: scanDate === date ? C.accent : C.mutedLight,
            cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
          }}>{label}</button>
        ))}
        <input type="date" value={scanDate} max={today()} onChange={e => setScanDate(e.target.value)} style={{
          flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: "8px 12px", color: C.mutedLight, fontFamily: "'DM Sans',sans-serif",
          fontSize: 13, outline: "none", colorScheme: "dark",
        }}/>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[["📷", "KI-Scan", "ai"], ["🍽️", "Notion", "notion"], ["✏️", "Manuell", "manual"]].map(([icon, label, key]) => (
          <button key={key} onClick={() => switchMode(key)} style={{
            flex: 1, padding: "14px 0", borderRadius: 14,
            border: `1px solid ${mode === key ? C.accent : C.border}`,
            background: mode === key ? `${C.accent}15` : C.card,
            color: mode === key ? C.accent : C.mutedLight,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>{label}
          </button>
        ))}
      </div>

      {/* ── AI MODE ── */}
      {mode === "ai" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${imageB64 ? C.accent : C.border}`, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>📷</span>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Foto</div><div style={{ fontSize: 11, color: C.muted }}>Optional</div></div>
              </div>
              {imageB64
                ? <button onClick={() => { setImageB64(null); setImagePreview(null); }} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.mutedLight, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>Entfernen</button>
                : <button onClick={() => fileRef.current.click()} style={{ background: `${C.accent}20`, border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Foto</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleImage}/>
            {imagePreview && <div style={{ padding: "0 14px 14px" }}><img src={imagePreview} alt="food" style={{ width: "100%", borderRadius: 10, maxHeight: 180, objectFit: "cover" }}/></div>}
          </div>

          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${text.trim() ? C.accent : C.border}`, marginBottom: 12 }}>
            <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>✏️</span>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Beschreibung</div><div style={{ fontSize: 11, color: C.muted }}>Text oder Sprache</div></div>
              </div>

            </div>

            <div style={{ padding: "0 14px 14px" }}>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder={imageB64 ? "Hinweise zum Foto: 'extra groß', 'ca. 400g'…" : "z.B. 'Döner mit Fladenbrot, extra Fleisch'"} rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontFamily: "'DM Sans',sans-serif", fontSize: 16, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6 }}/>
            </div>
          </div>

          <button onClick={analyzeAI} disabled={loading || (!text.trim() && !imageB64)} style={{ width: "100%", background: loading ? C.border : C.accent, color: loading ? C.muted : "#000", border: "none", borderRadius: 12, padding: "14px 0", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, cursor: loading ? "not-allowed" : "pointer", marginBottom: 16 }}>
            {loading ? "KI analysiert…" : "Nährwerte schätzen"}
          </button>

          {result && (
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, animation: "fadeIn .4s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: C.text, flex: 1, paddingRight: 10 }}>{result.name}</div>
                {result.confidence && <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", flexShrink: 0, color: confidenceColor[result.confidence] || C.muted, border: `1px solid ${confidenceColor[result.confidence] || C.muted}`, borderRadius: 6, padding: "3px 8px" }}>{result.confidence}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[["kcal", result.calories, C.accent], ["Protein", result.protein+"g", C.protein], ["Carbs", result.carbs+"g", C.carbs], ["Fett", result.fat+"g", C.fat]].map(([l,v,col]) => (
                  <div key={l} style={{ flex: 1, background: C.surface, borderRadius: 10, padding: "10px 0", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: col }}>{v}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
              {result.note && <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 14, borderLeft: `2px solid ${C.accent}`, paddingLeft: 10 }}>{result.note}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ flex: 1, background: C.accent, color: "#000", border: "none", borderRadius: 12, padding: "13px 0", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }} onClick={() => onAdd({ ...result, id: Date.now(), estimated: true, date: scanDate })}>Zum Log →</button>
                <button style={{ background: C.card, border: `1px solid ${C.border}`, color: C.mutedLight, borderRadius: 12, padding: "13px 16px", cursor: "pointer", fontSize: 13 }} onClick={() => { setResult(null); setText(""); setImageB64(null); setImagePreview(null); }}>Neu</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NOTION MODE ── */}
      {mode === "notion" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          {!selectedRecipe ? (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rezept suchen…" autoFocus style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", color: C.text, fontFamily: "'DM Sans',sans-serif", fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 12 }}/>
              {loadingRecipes && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>Lade Rezepte aus Notion…</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredRecipes.map(r => (
                  <div key={r.id} onClick={() => setSelectedRecipe(r)} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                    <div>
                      <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                        {r.calories > 0 ? `${r.calories} kcal · P${r.protein}g · C${r.carbs}g · F${r.fat}g` : "Keine Nährwerte"}
                        {r.cookingTime > 0 ? ` · ${r.cookingTime} Min` : ""}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        {r.tags.map(t => <span key={t} style={{ fontSize: 10, background: C.surface, borderRadius: 4, padding: "2px 6px", marginRight: 4, color: C.mutedLight }}>{t}</span>)}
                      </div>
                    </div>
                    {r.rating > 0 && <div style={{ color: C.fat, fontSize: 13, marginLeft: 10 }}>{"★".repeat(r.rating)}</div>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ animation: "fadeIn .2s ease" }}>
              <button onClick={() => setSelectedRecipe(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Zurück</button>
              <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.accent}`, marginBottom: 14 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: C.text, marginBottom: 12 }}>{selectedRecipe.name}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {[["kcal", selectedRecipe.calories, C.accent], ["P", selectedRecipe.protein+"g", C.protein], ["C", selectedRecipe.carbs+"g", C.carbs], ["F", selectedRecipe.fat+"g", C.fat]].map(([l,v,col]) => (
                    <div key={l} style={{ flex: 1, background: C.surface, borderRadius: 10, padding: "10px 0", textAlign: "center" }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: col }}>{v}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {selectedRecipe.cookingTime > 0 && <div style={{ fontSize: 12, color: C.muted }}>⏱ {selectedRecipe.cookingTime} Min · 💰 {selectedRecipe.costPerServing ? "€" + selectedRecipe.costPerServing : "–"}</div>}
              </div>

              <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 14 }}>
                <div style={{ padding: "14px 16px 10px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>Hinweise zur Portion</div>
                  <div style={{ fontSize: 12, color: C.muted }}>KI passt die Makros automatisch an</div>
                </div>
                <div style={{ padding: "0 14px 14px" }}>
                  <textarea value={recipeNote} onChange={e => setRecipeNote(e.target.value)} placeholder="z.B. 'halbe Portion', 'ohne Käse', 'doppelt Protein', '300g statt 400g'…" rows={3} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontFamily: "'DM Sans',sans-serif", fontSize: 16, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6 }}/>
                </div>
              </div>

              <button onClick={adjustRecipe} disabled={adjusting} style={{ width: "100%", background: adjusting ? C.border : C.accent, color: adjusting ? C.muted : "#000", border: "none", borderRadius: 12, padding: "14px 0", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, cursor: adjusting ? "not-allowed" : "pointer" }}>
                {adjusting ? "KI passt an…" : recipeNote.trim() ? "Anpassen & hinzufügen" : "Direkt hinzufügen"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MODE ── */}
      {mode === "manual" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Name</div>
              <input value={manual.name} onChange={e => setManual(p => ({...p, name: e.target.value}))} placeholder="Mahlzeit benennen…" style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontFamily: "'DM Sans',sans-serif", fontSize: 16, outline: "none", boxSizing: "border-box" }}/>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Kalorien", "calories", "kcal", C.accent], ["Protein", "protein", "g", C.protein], ["Carbs", "carbs", "g", C.carbs], ["Fett", "fat", "g", C.fat]].map(([label, key, unit, color]) => (
                <div key={key}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{label} ({unit})</div>
                  <input type="number" value={manual[key]} onChange={e => setManual(p => ({...p, [key]: e.target.value}))} placeholder="0" style={{ width: "100%", background: C.surface, border: `1px solid ${color}40`, borderRadius: 8, padding: "10px 12px", color: color, fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, outline: "none", boxSizing: "border-box", textAlign: "center" }}/>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => { if (!manual.name) return; onAdd({ ...manual, calories: parseFloat(manual.calories)||0, protein: parseFloat(manual.protein)||0, carbs: parseFloat(manual.carbs)||0, fat: parseFloat(manual.fat)||0, id: Date.now(), date: scanDate }); }} disabled={!manual.name} style={{ width: "100%", background: manual.name ? C.accent : C.border, color: manual.name ? "#000" : C.muted, border: "none", borderRadius: 12, padding: "14px 0", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2, cursor: manual.name ? "pointer" : "not-allowed" }}>
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

// ── BODY TAB ──────────────────────────────────────────────────────────────────
function WeightChart({ history, metric, color, unit }) {
  const data = history.filter(h => h[metric] > 0).slice(-12);
  if (data.length < 2) return (
    <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>Mindestens 2 Messungen nötig</div>
  );
  const vals = data.map(d => d[metric]);
  const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1;
  const W = 320, H = 120, PAD = 20;
  const points = data.map((d, i) => ({
    x: PAD + (i / (data.length-1)) * (W - PAD*2),
    y: PAD + ((max - d[metric]) / range) * (H - PAD*2),
    val: d[metric], date: d.date,
  }));
  const pathD = points.map((p,i) => (i===0?"M":"L") + " " + p.x + " " + p.y).join(" ");
  const areaD = pathD + " L " + points[points.length-1].x + " " + H + " L " + points[0].x + " " + H + " Z";
  const trend = vals[vals.length-1] - vals[0];
  const isGoodDown = ["weight","waist","hip"].includes(metric);
  const trendColor = trend === 0 ? C.muted : (isGoodDown ? (trend < 0 ? C.green : C.red) : (trend > 0 ? C.green : C.red));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: C.muted }}>{data[0].date.slice(5)} bis {data[data.length-1].date.slice(5)}</div>
        <div style={{ fontSize: 13, color: trendColor, fontWeight: 600 }}>{trend > 0 ? "+" : ""}{trend.toFixed(1)}{unit}</div>
      </div>
      <svg width="100%" viewBox={"0 0 " + W + " " + H} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={"grad-" + metric} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaD} fill={"url(#grad-" + metric + ")"}/>
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((p,i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={i===points.length-1?5:3} fill={i===points.length-1?color:"none"} stroke={color} strokeWidth="1.5"/>
            {i===points.length-1 && <text x={p.x} y={p.y-10} textAnchor="middle" fill={color} fontSize="11">{p.val}{unit}</text>}
          </g>
        ))}
        <text x={PAD} y={H-4} fill={C.muted} fontSize="9">{data[0].date.slice(5)}</text>
        <text x={W-PAD} y={H-4} fill={C.muted} fontSize="9" textAnchor="end">{data[data.length-1].date.slice(5)}</text>
      </svg>
    </div>
  );
}

function AnalyticsTab({ goals }) {
  const now = new Date();
  const [subTab, setSubTab] = useState("nutrition");
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [monthData, setMonthData] = useState([]);
  const [weekData, setWeekData] = useState([]);
  const [bodyHistory, setBodyHistory] = useState([]);
  const [activeChart, setActiveChart] = useState("weight");
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({ weight:"", waist:"", chest:"", hip:"" });
  const [bodyAnalysis, setBodyAnalysis] = useState(null);
  const [bodyAnalyzing, setBodyAnalyzing] = useState(false);

  useEffect(() => {
    Promise.all([loadMonthMeals(viewYear, viewMonth), loadWeekMeals(), loadBodyMeasurements()]).then(([month, week, body]) => {
      setMonthData(month);
      setBodyHistory(body);
      const days = ["Mo","Di","Mi","Do","Fr","Sa","So"];
      const todayIdx = (new Date().getDay()+6)%7;
      setWeekData(days.map((day,i) => {
        const date = new Date();
        date.setDate(date.getDate()-(todayIdx-i));
        const dateStr = date.toISOString().split("T")[0];
        const dayMeals = week.filter(m => m.date===dateStr);
        return { day, dateStr, cal: dayMeals.reduce((a,m)=>a+(m.calories||0),0), protein: dayMeals.reduce((a,m)=>a+(m.protein||0),0), today: i===todayIdx };
      }));
    });
  }, [viewMonth, viewYear]);

  const dailyTotals = {};
  monthData.forEach(m => {
    if (!dailyTotals[m.date]) dailyTotals[m.date] = { calories:0, protein:0, carbs:0, fat:0 };
    dailyTotals[m.date].calories += m.calories||0;
    dailyTotals[m.date].protein += m.protein||0;
    dailyTotals[m.date].carbs += m.carbs||0;
    dailyTotals[m.date].fat += m.fat||0;
  });

  const loggedDays = Object.keys(dailyTotals).length;
  const avgCal = loggedDays>0 ? Math.round(Object.values(dailyTotals).reduce((a,d)=>a+d.calories,0)/loggedDays) : 0;
  const avgProtein = loggedDays>0 ? Math.round(Object.values(dailyTotals).reduce((a,d)=>a+d.protein,0)/loggedDays) : 0;
  const avgCarbs = loggedDays>0 ? Math.round(Object.values(dailyTotals).reduce((a,d)=>a+d.carbs,0)/loggedDays) : 0;
  const avgFat = loggedDays>0 ? Math.round(Object.values(dailyTotals).reduce((a,d)=>a+d.fat,0)/loggedDays) : 0;
  const proteinGoalDays = Object.values(dailyTotals).filter(d=>d.protein>=goals.protein).length;
  const avgWeekCal = weekData.filter(d=>d.cal>0).length>0 ? Math.round(weekData.filter(d=>d.cal>0).reduce((a,d)=>a+d.cal,0)/weekData.filter(d=>d.cal>0).length) : 0;
  const avgWeekProtein = weekData.filter(d=>d.protein>0).length>0 ? Math.round(weekData.filter(d=>d.protein>0).reduce((a,d)=>a+d.protein,0)/weekData.filter(d=>d.protein>0).length) : 0;

  let streak = 0;
  const checkDate = new Date();
  for (let i=0; i<365; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (dailyTotals[dateStr]) { streak++; checkDate.setDate(checkDate.getDate()-1); } else break;
  }

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayOfMonth = (new Date(viewYear, viewMonth-1, 1).getDay()+6)%7;
  const monthName = new Date(viewYear, viewMonth-1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const getHeatmapColor = (dateStr) => {
    const d = dailyTotals[dateStr];
    if (!d) return C.border;
    const pct = d.calories/goals.calories;
    if (pct>=0.9 && pct<=1.1) return C.green;
    if (pct>=0.7) return C.accent;
    if (pct>0) return "#555";
    return C.border;
  };

  const bodyMetrics = [
    { key:"weight", label:"Gewicht", unit:"kg", color:C.accent },
    { key:"waist", label:"Bauch", unit:"cm", color:C.protein },
    { key:"chest", label:"Brust", unit:"cm", color:C.carbs },
    { key:"hip", label:"Hüfte", unit:"cm", color:C.fat },
  ];

  const latest = bodyHistory[bodyHistory.length-1];
  const prev = bodyHistory[bodyHistory.length-2];

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1, marginBottom: 16 }}>
        Ana<span style={{ color: C.accent }}>lytics</span>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["nutrition", "🍽️ Ernährung"], ["body", "💪 Körper"]].map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12,
            border: `1px solid ${subTab===key ? C.accent : C.border}`,
            background: subTab===key ? `${C.accent}15` : C.card,
            color: subTab===key ? C.accent : C.muted,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600,
          }}>{label}</button>
        ))}
      </div>

      {/* ── NUTRITION SUB-TAB ── */}
      {subTab === "nutrition" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Ø Kalorien", value: avgCal, unit: "kcal", color: C.accent, sub: `Ziel: ${goals.calories}` },
              { label: "Ø Protein", value: avgProtein, unit: "g", color: C.protein, sub: `Ziel: ${goals.protein}g` },
              { label: "Log-Streak", value: streak, unit: "Tage", color: C.carbs, sub: "in Folge" },
              { label: "Protein-Ziel ✓", value: proteinGoalDays, unit: "Tage", color: C.green, sub: `von ${loggedDays} geloggt` },
            ].map(k => (
              <div key={k.label} style={{ background: C.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{k.label}</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, color: k.color }}>{k.value}<span style={{ fontSize: 13, color: C.muted, marginLeft: 2 }}>{k.unit}</span></div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Two Rings */}
          <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 16 }}>Ø Diese Woche</div>
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              {[[avgWeekCal, goals.calories, C.accent, "kcal", "Kalorien"], [avgWeekProtein, goals.protein, C.protein, "g", "Protein"]].map(([val, goal, color, unit, label]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <Ring value={val} goal={goal} color={color} size={110} sw={10}/>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color, lineHeight: 1 }}>{goal>0?Math.round((val/goal)*100):0}%</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: C.text }}>{val}{unit}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>/ {goal}{unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Week bars */}
          <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 16 }}>Diese Woche</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              {weekData.map(d => {
                const pct = Math.min((d.cal/goals.calories)*100, 100);
                return (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ color: d.today?C.accent:C.muted, fontSize: 9, fontFamily: "'DM Mono',monospace" }}>{d.cal||"–"}</div>
                    <div style={{ width: "100%", height: 70, background: C.border, borderRadius: 4, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                      <div style={{ width: "100%", height: `${pct}%`, background: d.today?C.accent:d.cal>goals.calories?C.red:"#2a2a2a", borderRadius: "4px 4px 0 0", minHeight: d.cal>0?4:0 }}/>
                    </div>
                    <div style={{ color: d.today?C.accent:C.muted, fontSize: 10, fontWeight: d.today?700:400 }}>{d.day}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Month Heatmap */}
          <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <button onClick={() => { const d=new Date(viewYear,viewMonth-2); setViewMonth(d.getMonth()+1); setViewYear(d.getFullYear()); }} style={{ background:"none", border:"none", color:C.mutedLight, cursor:"pointer", fontSize:22 }}>‹</button>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1 }}>{monthName}</div>
              <button onClick={() => { const d=new Date(viewYear,viewMonth); if(d<=new Date()){setViewMonth(d.getMonth()+1);setViewYear(d.getFullYear());}}} style={{ background:"none", border:"none", color:C.mutedLight, cursor:"pointer", fontSize:22 }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {["Mo","Di","Mi","Do","Fr","Sa","So"].map(d => <div key={d} style={{ textAlign:"center", fontSize:9, color:C.muted, paddingBottom:4 }}>{d}</div>)}
              {Array.from({length:firstDayOfMonth}).map((_,i) => <div key={`e${i}`}/>)}
              {Array.from({length:daysInMonth}).map((_,i) => {
                const day=i+1;
                const dateStr=`${viewYear}-${String(viewMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const color=getHeatmapColor(dateStr);
                const isToday=dateStr===today();
                return <div key={day} style={{ aspectRatio:"1", borderRadius:4, background:color, display:"flex", alignItems:"center", justifyContent:"center", border:isToday?`1.5px solid ${C.accent}`:"none", fontSize:9, color:color===C.border?C.muted:"#000", fontWeight:600 }}>{day}</div>;
              })}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
              {[[C.green,"Im Ziel"],[C.accent,"Nah dran"],["#555","Geloggt"],[C.border,"Kein Log"]].map(([c,l]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:c }}/>
                  <span style={{ fontSize:10, color:C.muted }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Macro averages */}
          <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 16 }}>Ø Monat</div>
            {[["Kalorien",avgCal,goals.calories,C.accent,"kcal"],["Protein",avgProtein,goals.protein,C.protein,"g"],["Carbs",avgCarbs,goals.carbs,C.carbs,"g"],["Fett",avgFat,goals.fat,C.fat,"g"]].map(([l,v,g,c,u]) => (
              <div key={l} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, color:C.mutedLight }}>{l}</span>
                  <span style={{ fontSize:13, color:C.text }}>{v}{u} <span style={{ color:C.muted }}>/ {g}{u}</span></span>
                </div>
                <div style={{ height:4, background:C.border, borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${Math.min((v/g)*100,100)}%`, background:v>g?C.red:c, borderRadius:2 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BODY SUB-TAB ── */}
      {subTab === "body" && (
        <div style={{ animation: "fadeIn .2s ease" }}>
          {/* Latest measurements */}
          {latest && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {bodyMetrics.map(m => {
                const delta = latest && prev ? (latest[m.key] - prev[m.key]).toFixed(1) : null;
                const isGoodDown = ["weight","waist","hip"].includes(m.key);
                const positive = delta ? (isGoodDown ? parseFloat(delta)<0 : parseFloat(delta)>0) : null;
                return (
                  <div key={m.key} style={{ background: C.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{m.label}</div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, color: m.color }}>{latest[m.key]||"–"}<span style={{ fontSize: 13, color: C.muted, marginLeft: 2 }}>{m.unit}</span></div>
                    {delta && <div style={{ fontSize: 12, color: positive?C.green:C.red, marginTop: 2 }}>{parseFloat(delta)>0?"+":""}{delta}{m.unit}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Chart selector */}
          <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 12 }}>Verlauf</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {bodyMetrics.map(m => (
                <button key={m.key} onClick={() => setActiveChart(m.key)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 8,
                  border: `1px solid ${activeChart===m.key?m.color:C.border}`,
                  background: activeChart===m.key?`${m.color}15`:"none",
                  color: activeChart===m.key?m.color:C.muted,
                  cursor: "pointer", fontSize: 10, fontFamily: "'DM Mono',monospace",
                }}>{m.label}</button>
              ))}
            </div>
            {bodyMetrics.filter(m=>m.key===activeChart).map(m => (
              <WeightChart key={m.key} history={bodyHistory} metric={m.key} color={m.color} unit={m.unit}/>
            ))}
          </div>

          {/* Add measurement form */}
          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1 }}>Neue Messung</div>
              <button onClick={() => setShowMeasurementForm(!showMeasurementForm)} style={{
                background: C.accent, color: "#000", border: "none", borderRadius: 8,
                width: 28, height: 28, fontSize: 20, cursor: "pointer", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{showMeasurementForm ? "−" : "+"}</button>
            </div>
            {showMeasurementForm && (
              <div style={{ padding: "0 20px 20px", animation: "fadeIn .2s ease" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {bodyMetrics.map(m => (
                    <div key={m.key}>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{m.label} ({m.unit})</div>
                      <input type="number" step="0.1" value={measurementForm[m.key]}
                        onChange={e => setMeasurementForm(p => ({...p, [m.key]: e.target.value}))}
                        placeholder={latest?.[m.key] || "0"}
                        style={{ width: "100%", background: C.surface, border: `1px solid ${m.color}40`, borderRadius: 8, padding: "10px 12px", color: m.color, fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, outline: "none", boxSizing: "border-box", textAlign: "center" }}/>
                    </div>
                  ))}
                </div>
                <button onClick={async () => {
                  const entry = { date: new Date().toISOString().split("T")[0], ...Object.fromEntries(Object.entries(measurementForm).map(([k,v])=>[k,parseFloat(v)||0])) };
                  const saved = await saveBodyMeasurement(entry);
                  if (saved) setBodyHistory(p => [...p, saved]);
                  setMeasurementForm({ weight:"", waist:"", chest:"", hip:"" });
                  setShowMeasurementForm(false);
                }} style={{ width: "100%", background: C.accent, color: "#000", border: "none", borderRadius: 10, padding: "12px 0", fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2, cursor: "pointer" }}>
                  Speichern
                </button>
              </div>
            )}
          </div>

          {/* History table */}
          {bodyHistory.length > 0 && (
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 12 }}>Verlauf</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>{["Datum","Gewicht","Bauch","Brust","Hüfte"].map(h => (
                      <th key={h} style={{ color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 10, textAlign: "left", padding: "4px 8px 10px 0", fontWeight: 400, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {[...bodyHistory].reverse().slice(0,8).map((e, i) => (
                      <tr key={e.date} style={{ opacity: i===0?1:0.7 }}>
                        <td style={{ padding: "8px 8px 8px 0", color: i===0?C.accent:C.mutedLight, fontSize: 12 }}>{e.date.slice(5)}</td>
                        {["weight","waist","chest","hip"].map(k => (
                          <td key={k} style={{ padding: "8px 8px 8px 0", color: C.text }}>{e[k]||"–"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KI Analysis */}
          <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1 }}>KI-Analyse</div>
              <div style={{ background: C.accent, color: "#000", fontSize: 10, fontFamily: "'DM Mono',monospace", padding: "3px 8px", borderRadius: 20, fontWeight: 700 }}>AI</div>
            </div>
            {bodyAnalysis ? (
              <div style={{ animation: "fadeIn .4s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: {positiv:C.green,neutral:C.fat,negativ:C.red}[bodyAnalysis.trend]||C.muted }}/>
                  <span style={{ color: {positiv:C.green,neutral:C.fat,negativ:C.red}[bodyAnalysis.trend], fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{bodyAnalysis.trend}</span>
                </div>
                <div style={{ color: C.mutedLight, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{bodyAnalysis.summary}</div>
                {bodyAnalysis.recommendations?.map((r,i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ color: C.accent, fontSize: 16, lineHeight: 1 }}>→</span>
                    <span style={{ color: C.text, fontSize: 13 }}>{r}</span>
                  </div>
                ))}
                {bodyAnalysis.calorieAdjustment && (
                  <div style={{ marginTop: 14, background: C.surface, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: 1, marginBottom: 4 }}>KALORIEN-EMPFEHLUNG</div>
                    <div style={{ color: bodyAnalysis.calorieAdjustment==="erhöhen"?C.green:bodyAnalysis.calorieAdjustment==="reduzieren"?C.red:C.fat, fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1 }}>
                      {bodyAnalysis.calorieAdjustment.toUpperCase()}
                    </div>
                    <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{bodyAnalysis.calorieReason}</div>
                  </div>
                )}
                <button onClick={() => setBodyAnalysis(null)} style={{ marginTop: 14, background: "none", border: `1px solid ${C.border}`, color: C.mutedLight, width: "100%", padding: "8px 0", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                  Neu analysieren →
                </button>
              </div>
            ) : (
              <div>
                <div style={{ color: C.muted, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>Analysiere deinen Fortschritt — erhalte personalisierte Empfehlungen.</div>
                <button onClick={async () => {
                  setBodyAnalyzing(true);
                  const sys = `Du bist Personal Trainer und Ernährungsberater. Analysiere die Körperdaten und gib konkrete Empfehlungen.
Antworte NUR mit JSON: {"trend":"positiv|neutral|negativ","summary":"2-3 Sätze","recommendations":["Tipp 1","Tipp 2","Tipp 3"],"calorieAdjustment":"erhöhen|beibehalten|reduzieren","calorieReason":"kurze Begründung"}`;
                  try {
                    const raw = await callClaude(sys, "Körperdaten: " + JSON.stringify(bodyHistory.slice(-6)) + " Aktuelles Kalorienziel: " + goals.calories);
                    setBodyAnalysis(JSON.parse(raw));
                  } catch(e) { console.error(e); }
                  setBodyAnalyzing(false);
                }} disabled={bodyAnalyzing || bodyHistory.length < 2} style={{ width: "100%", background: bodyAnalyzing||bodyHistory.length<2?C.border:C.accent, color: bodyAnalyzing||bodyHistory.length<2?C.muted:"#000", border: "none", borderRadius: 10, padding: "12px 0", fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 2, cursor: bodyAnalyzing||bodyHistory.length<2?"not-allowed":"pointer" }}>
                  {bodyAnalyzing ? "Analysiere…" : bodyHistory.length < 2 ? "Mindestens 2 Messungen nötig" : "Analyse starten"}
                </button>
              </div>
            )}
          </div>

          {!latest && (
            <div style={{ background: C.card, borderRadius: 16, padding: 30, border: `1px solid ${C.border}`, textAlign: "center" }}>
              <div style={{ color: C.muted, fontSize: 14 }}>Noch keine Körpermessungen</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── MEAL PLAN CARD ───────────────────────────────────────────────────────────
function MealPlanCard({ meal }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 2, letterSpacing: 1 }}>{meal.type?.toUpperCase()}</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>
              {meal.recipe}
              {meal.isNew && <span style={{ marginLeft: 6, fontSize: 10, background: `${C.accent}20`, color: C.accent, borderRadius: 4, padding: "2px 6px" }}>✦ Neu</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", marginLeft: 10 }}>
            <div style={{ color: C.accent, fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>{meal.calories}</div>
            <div style={{ fontSize: 10, color: C.muted }}>kcal</div>
          </div>
          <span style={{ color: C.muted, fontSize: 14, marginLeft: 8, marginTop: 14 }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {/* Macro row */}
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {[["P", meal.protein+"g", C.protein], ["C", meal.carbs+"g", C.carbs], ["F", meal.fat+"g", C.fat]].map(([l,v,c]) => (
            <span key={l} style={{ fontSize: 11, color: c }}>{l}: {v}</span>
          ))}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, animation: "fadeIn .2s ease" }}>
          {meal.ingredients?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: 1, marginBottom: 6 }}>ZUTATEN</div>
              {meal.ingredients.map((ing, i) => (
                <div key={i} style={{ fontSize: 12, color: C.mutedLight, padding: "3px 0", borderBottom: `1px solid ${C.border}` }}>· {ing}</div>
              ))}
            </div>
          )}
          {meal.steps?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: 1, marginBottom: 6 }}>ZUBEREITUNG</div>
              {meal.steps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
                  <span style={{ color: C.accent, fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, lineHeight: 1.2, flexShrink: 0 }}>{i+1}</span>
                  <span style={{ fontSize: 12, color: C.mutedLight, lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PLAN TAB ─────────────────────────────────────────────────────────────────
function PlanTab({ goals }) {
  const [filters, setFilters] = useState({ minRating: 0, maxCookTime: 999, maxCost: 999, tags: [] });
  const [recipes, setRecipes] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [planMode, setPlanMode] = useState("mix"); // "notion"|"inspiration"|"mix"
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d.toISOString().split("T")[0];
  });

  const DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
  const MEALS = ["Frühstück","Mittagessen","Abendessen","Snack"];

  const ALL_TAGS = ["High Protein","Vegan","Vegetarisch","Meal Prep","Bowl","Curry","Dinner","Lunch","Breakfast","Sides","Quick"];

  useEffect(() => {
    loadNotionRecipes().then(data => { setRecipes(data); setLoadingRecipes(false); });
  }, []);

  const generatePlan = async () => {
    setLoading(true); setPlan(null);
    const filtered = recipes.filter(r =>
      r.rating >= filters.minRating &&
      (r.cookingTime === 0 || r.cookingTime <= filters.maxCookTime) &&
      (r.costPerServing === 0 || r.costPerServing <= filters.maxCost) &&
      (filters.tags.length === 0 || filters.tags.some(t => r.tags.includes(t)))
    );

    const sys = `Du bist Ernährungsberater. Erstelle einen 7-Tage Mahlzeitenplan.
Antworte NUR mit JSON, kein Markdown:
{"days":[{"day":"Montag","meals":[{"type":"Frühstück","recipe":"Name","calories":X,"protein":X,"carbs":X,"fat":X,"fiber":X,"isNew":true,"ingredients":["200g Haferflocken","1 Banane"],"steps":["Schritt 1","Schritt 2"]},...],"totalCalories":X,"totalProtein":X,"totalCarbs":X,"totalFat":X},...]}`;

    const notionPart = filtered.length > 0 && planMode !== "inspiration"
      ? `Vorhandene Rezepte (bevorzuge höher bewertete, markiere isNew:false): ${JSON.stringify(filtered.slice(0,20).map(r=>({name:r.name,cal:r.calories,p:r.protein,c:r.carbs,f:r.fat,rating:r.rating,tags:r.tags})))}`
      : "";

    const inspirationPart = planMode !== "notion"
      ? `Erfinde auch neue kreative Gerichte (markiere isNew:true) basierend auf Philipps Vorlieben: mediterrane Küche, Hühnchen, Pasta, gesund aber sättigend, günstig. Neue Gerichte sollen realistisch kochbar sein.`
      : "";

    const mixNote = planMode === "mix"
      ? "Mische vorhandene Rezepte und neue Ideen ausgewogen (ca. 50/50)."
      : planMode === "inspiration"
      ? "Erstelle ausschließlich neue, kreative Gerichte — keine vorhandenen Rezepte verwenden."
      : "Verwende ausschließlich die vorhandenen Rezepte.";

    const prompt = `Meine Ziele: ${goals.calories} kcal, ${goals.protein}g Protein, ${goals.carbs}g Carbs, ${goals.fat}g Fett.
${notionPart}
${inspirationPart}
${mixNote}
Erstelle einen 3-Tage Plan (Montag bis Mittwoch). Maximal 2-3 Zutaten pro Gericht, maximal 2 Kochschritte. Makros täglich nah am Ziel. Halte die Antwort kurz und präzise.`;

    try {
      const raw = await callClaude(sys, prompt);
      setPlan(JSON.parse(raw));
    } catch(e) { console.error(e); alert("Fehler beim Generieren — bitte nochmal versuchen"); }
    setLoading(false);
  };

  const addPlanToLog = async () => {
    if (!plan) return;
    const weekStartDate = new Date(weekStart + "T00:00:00");
    for (let dayIdx = 0; dayIdx < plan.days.length; dayIdx++) {
      const day = plan.days[dayIdx];
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + dayIdx);
      const dateStr = date.toISOString().split("T")[0];
      for (const meal of day.meals) {
        await saveMeal({ name: `${meal.recipe} (${meal.type})`, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, date: dateStr });
      }
    }
    alert("Plan wurde ins Log übernommen! ✅");
  };

  const toggleTag = (tag) => {
    setFilters(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(t=>t!==tag) : [...p.tags, tag] }));
  };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1, marginBottom: 4 }}>
        Meal<span style={{ color: C.accent }}>-Plan</span>
      </div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>KI erstellt deinen Wochenplan aus deinen Notion-Rezepten</div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["notion", "📚 Meine Rezepte"], ["mix", "✨ Mix"], ["inspiration", "💡 Neue Ideen"]].map(([key, label]) => (
          <button key={key} onClick={() => setPlanMode(key)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 12,
            border: `1px solid ${planMode===key ? C.accent : C.border}`,
            background: planMode===key ? `${C.accent}15` : C.card,
            color: planMode===key ? C.accent : C.muted,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
          }}>{label}</button>
        ))}
      </div>
      {planMode === "inspiration" && (
        <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.accent }}>
          ✦ KI erfindet neue Gerichte basierend auf deinen Vorlieben: mediterran, Hühnchen, Pasta, gesund & günstig
        </div>
      )}

      {/* Filters */}
      <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>Filter</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            ["Min. ⭐", "minRating", 0, 5, 1, ""],
            ["Max. ⏱", "maxCookTime", 0, 120, 15, " Min"],
            ["Max. 💰", "maxCost", 0, 20, 1, "€"],
          ].map(([label, key, min, max, step, unit]) => (
            <div key={key}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: C.accent, textAlign: "center", marginBottom: 4 }}>
                {filters[key] === (key==="maxCookTime"?999:key==="maxCost"?999:0) ? "Alle" : filters[key]+unit}
              </div>
              <input type="range" min={min} max={max} step={step} value={filters[key]===999?max:filters[key]}
                onChange={e => setFilters(p=>({...p,[key]:key==="minRating"?parseInt(e.target.value):parseInt(e.target.value)===max?999:parseInt(e.target.value)}))}
                style={{ width: "100%", accentColor: C.accent }}/>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>TAGS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_TAGS.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12,
              border: `1px solid ${filters.tags.includes(tag) ? C.accent : C.border}`,
              background: filters.tags.includes(tag) ? `${C.accent}20` : "none",
              color: filters.tags.includes(tag) ? C.accent : C.muted,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}>{tag}</button>
          ))}
        </div>
      </div>

      {/* Week selector */}
      <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: C.mutedLight }}>Woche ab</div>
        <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={{ background: "none", border: "none", color: C.accent, fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, outline: "none", cursor: "pointer", colorScheme: "dark" }}/>
      </div>

      {/* Generate button */}
      <button onClick={generatePlan} disabled={loading || loadingRecipes} style={{
        width: "100%", background: loading||loadingRecipes ? C.border : C.accent,
        color: loading||loadingRecipes ? C.muted : "#000", border: "none", borderRadius: 12,
        padding: "14px 0", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2,
        cursor: loading||loadingRecipes ? "not-allowed" : "pointer", marginBottom: 16,
      }}>
        {loadingRecipes ? "Lade Rezepte…" : loading ? "KI plant…" : "3-Tage Plan generieren ✦"}
      </button>

      {/* Plan display */}
      {plan && (
        <div style={{ animation: "fadeIn .4s ease" }}>
          {plan.days?.map((day, i) => (
            <div key={i} style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: C.text, letterSpacing: 1 }}>{day.day}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: C.accent }}>{day.totalCalories} kcal</span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: C.protein }}>{day.totalProtein}g P</span>
                </div>
              </div>
              {day.meals?.map((meal, j) => (
                <MealPlanCard key={j} meal={meal} goals={goals}/>
              ))}
              {/* Day totals */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                {[["kcal", day.totalCalories, goals.calories, C.accent], ["P", day.totalProtein+"g", goals.protein, C.protein], ["C", day.totalCarbs+"g", goals.carbs, C.carbs], ["F", day.totalFat+"g", goals.fat, C.fat]].map(([l,v,g,c]) => (
                  <div key={l} style={{ flex: 1, textAlign: "center", background: C.surface, borderRadius: 8, padding: "6px 0" }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: c }}>{v}</div>
                    <div style={{ fontSize: 9, color: C.muted }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button onClick={addPlanToLog} style={{
            width: "100%", background: C.green, color: "#000", border: "none", borderRadius: 12,
            padding: "14px 0", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 2,
            cursor: "pointer", marginBottom: 16,
          }}>
            Plan ins Log übernehmen (3 Tage) →
          </button>

          <button onClick={() => setPlan(null)} style={{
            width: "100%", background: "none", border: `1px solid ${C.border}`,
            color: C.muted, borderRadius: 12, padding: "11px 0",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, cursor: "pointer",
          }}>Neu generieren</button>
        </div>
      )}
    </div>
  );
}

// ── GOALS TAB ─────────────────────────────────────────────────────────────────
function GoalsTab({ goals, setGoals }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goals);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { id, created_at, ...rest } = form;
    await saveGoals(rest);
    setGoals(rest);
    setSaving(false); setSaved(true); setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 1 }}>
            Tages<span style={{ color: C.accent }}>ziele</span>
          </div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Empfohlen für Ausdauersport ~85kg</div>
        </div>
        <button onClick={() => editing ? handleSave() : setEditing(true)} disabled={saving} style={{
          background: editing ? C.accent : C.card, color: editing ? "#000" : C.mutedLight,
          border: `1px solid ${editing ? "transparent" : C.border}`,
          borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
        }}>
          {saving ? "Speichert…" : saved ? "✓ Gespeichert" : editing ? "Speichern" : "Anpassen"}
        </button>
      </div>

      {editing && (
        <div style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: C.accent, fontSize: 12 }}>Werte anpassen — tippe in die Felder</span>
          <button onClick={() => setForm(DEFAULT_GOALS)} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer" }}>Reset</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {GOAL_META.map(m => {
          const val = form[m.key] ?? 0;
          return (
            <div key={m.key} style={{ background: C.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{m.unit} / Tag</div>
                  </div>
                </div>
                {editing ? (
                  <input type="number" value={form[m.key] ?? ""} onChange={e => setForm(p => ({ ...p, [m.key]: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 90, background: C.surface, border: `1px solid ${m.color}`, borderRadius: 8, padding: "8px 10px", color: m.color, fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, outline: "none", textAlign: "right" }}/>
                ) : (
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: m.color, letterSpacing: 1 }}>
                    {val}<span style={{ fontSize: 13, color: C.muted, marginLeft: 2 }}>{m.unit}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <button onClick={() => { setEditing(false); setForm(goals); }} style={{ width: "100%", marginTop: 12, background: "none", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 10, padding: "11px 0", fontSize: 13, cursor: "pointer" }}>Abbrechen</button>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [logged, setLogged] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today());

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

  useEffect(() => {
    loadTodayMeals(selectedDate).then(meals => setLogged(meals));
  }, [selectedDate]);

  const handleAddFromScan = async (meal) => {
    const saved = await saveMeal(meal);
    if (saved) setLogged(p => [...p, saved]);
    setTab("today");
  };

  const navItems = [
    { key: "today", icon: "◉", label: "Heute" },
    { key: "scan", icon: "⬡", label: "Scan" },
    { key: "plan", icon: "📅", label: "Plan" },
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
        {tab === "today" && <TodayTab logged={logged} setLogged={setLogged} goals={goals} onOpenScan={() => setTab("scan")} selectedDate={selectedDate} setSelectedDate={setSelectedDate}/>}
        {tab === "scan" && <ScanTab onAdd={handleAddFromScan}/>}
        {tab === "plan" && <PlanTab goals={goals} recipes={[]}/>}
        {tab === "week" && <AnalyticsTab goals={goals}/>}
        {tab === "goals" && <GoalsTab goals={goals} setGoals={setGoals}/>}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, zIndex: 100 }}>
        <div style={{ display: "flex", width: "100%", maxWidth: 430, margin: "0 auto", padding: "8px 0 24px", alignItems: "center" }}>
          <button onClick={() => setTab("today")} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: tab === "today" ? C.accent : C.muted }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>Heute</span>
          </button>
          <button onClick={() => setTab("plan")} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: tab === "plan" ? C.accent : C.muted }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M6.5 8h11l1 7h-3l-1 7H10l-1-7H6l1-7z"/></svg>
            <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>Plan</span>
          </button>
          <button onClick={() => setTab("scan")} style={{ flex: "0 0 64px", width: 64, height: 64, borderRadius: "50%", background: C.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -24, boxShadow: `0 4px 20px ${C.accent}60` }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button onClick={() => setTab("week")} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: tab === "week" ? C.accent : C.muted }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-6"/></svg>
            <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>Analytics</span>
          </button>
          <button onClick={() => setTab("goals")} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: tab === "goals" ? C.accent : C.muted }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
            <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>Ziele</span>
          </button>
        </div>
      </div>
    </div>
  );
}
