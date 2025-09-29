import React, { useEffect, useMemo, useRef, useState } from "react";

function SpinnerWheel({ names, spinningRequest, onResult, size = 360 }) {
  const canvasRef = useRef(null);
  const [angle, setAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const requestRef = useRef();
  const startRef = useRef();
  const startAngleRef = useRef(0);
  const durationRef = useRef(0);
  const targetAngleRef = useRef(0);

  const segments = useMemo(() => {
    const n = Math.max(names.length, 1);
    const step = (2 * Math.PI) / n;
    const items = names.length ? names : ["Add names →"];
    return items.map((label, i) => ({ label, start: i * step, end: (i + 1) * step, mid: i * step + step / 2 }));
  }, [names]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = size * dpr;
    const H = size * dpr;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const r = (Math.min(W, H) / 2) * 0.92;
    const cx = W / 2;
    const cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    segments.forEach((seg, i) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, seg.start, seg.end);
      ctx.closePath();
      ctx.fillStyle = `hsl(${(i * 137.508) % 360} 70% 60%)`;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
    });
    ctx.fillStyle = "#111";
    ctx.font = `${14 * dpr}px system-ui`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    segments.forEach((seg) => {
      const a = seg.start + (seg.end - seg.start) / 2;
      const lx = Math.cos(a) * (r * 0.86);
      const ly = Math.sin(a) * (r * 0.86);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a);
      const label = seg.label.length > 24 ? seg.label.slice(0, 24) + "…" : seg.label;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = "#111";
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(r + 6 * dpr, 0);
    ctx.lineTo(r + 24 * dpr, 10 * dpr);
    ctx.lineTo(r + 24 * dpr, -10 * dpr);
    ctx.closePath();
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.restore();
  }, [angle, segments, size]);

  useEffect(() => {
    if (!spinningRequest || isSpinning || !names.length) return;
    const TWO_PI = Math.PI * 2;
    const extraTurns = 8 + Math.random() * 2;
    targetAngleRef.current = angle + extraTurns * TWO_PI;
    startAngleRef.current = angle;
    durationRef.current = 5000;
    startRef.current = undefined;
    setIsSpinning(true);
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const animate = (ts) => {
      if (startRef.current === undefined) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationRef.current);
      const eased = easeOutCubic(t);
      const value = startAngleRef.current + (targetAngleRef.current - startAngleRef.current) * eased;
      setAngle(value);
      if (t < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        const n = Math.max(names.length, 1);
        const step = TWO_PI / n;
        const finalAngle = ((value % TWO_PI) + TWO_PI) % TWO_PI;
        const phi = (TWO_PI - finalAngle) % TWO_PI;
        let idx = Math.floor(phi / step);
        if (idx >= n) idx = n - 1;
        onResult?.({ label: names[idx] });
      }
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [spinningRequest]);

  return <canvas ref={canvasRef} className="rounded-2xl shadow-lg bg-white" />;
}

function computeGroupSuggestions(total, minSize = 2, maxSize = 9999) {
  if (!Number.isFinite(total) || total < 2) return [];
  const all = [];
  const seen = new Set();

  for (let k = 2; k <= total; k++) {
    const small = Math.floor(total / k);
    const rem = total % k; // number of groups needing +1
    const big = small + 1;

    if (small < minSize || big > maxSize) continue;

    const bigCount = rem;
    const smallCount = k - rem;
    const sum = bigCount * big + smallCount * small;
    if (sum !== total) continue; // exact only

    const parts = [];
    if (bigCount > 0) parts.push(`${bigCount} group${bigCount > 1 ? "s" : ""} of ${big}`);
    if (smallCount > 0) parts.push(`${smallCount} group${smallCount > 1 ? "s" : ""} of ${small}`);
    const label = parts.join(" and ");

    const key = `${k}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    all.push({
      k,
      label,
      score: big - small, // 0 = perfect equal sizes
      sizes: { small, big, bigCount, smallCount },
      isPerfect: rem === 0,
    });
  }

  // If there is ANY perfect equal-split option for this total, only show perfect ones.
  const hasPerfect = all.some((o) => o.isPerfect);
  const options = hasPerfect ? all.filter((o) => o.isPerfect) : all;

  return options.sort((a, b) => a.score - b.score || a.k - b.k);
}

export default function App() {
  const [nameInput, setNameInput] = useState("");
  const [names, setNames] = useState([]);
  const [spinToken, setSpinToken] = useState(0);
  const [selection, setSelection] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [chosenOption, setChosenOption] = useState(null);
  const [groups, setGroups] = useState([]);
  const [customTitles, setCustomTitles] = useState({});
  const [history, setHistory] = useState([]);
  const pendingGroupRef = useRef(null);

  const remaining = names;
  useEffect(() => { setSuggestions(computeGroupSuggestions(remaining.length)); }, [remaining.length]);

  function addNamesFromText(text) {
    const parts = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setNames((prev) => Array.from(new Set([...prev, ...parts])));
  }
  function handleAddName() { addNamesFromText(nameInput); setNameInput(""); }
  function removeName(idx) { setNames((prev) => prev.filter((_, i) => i !== idx)); }
  function clearAllNames() { if (!confirm("Clear all names?")) return; setNames([]); setGroups([]); }

  function createGroupsFromChoice(choice) {
    if (!choice) return;
    const { k, sizes } = choice;
    const { small, big, bigCount, smallCount } = sizes;
    const arr = [];
    for (let i = 0; i < k; i++) {
      const size = i < bigCount ? big : small;
      arr.push({ id: i, title: `Group ${i + 1}`, members: [], maxSize: size });
    }
    setGroups(arr);
    setCustomTitles({});
  }

  function handleSpinToGroup(groupIndex) {
    if (!remaining.length) return;
    const g = groups[groupIndex];
    if (g.members.length >= g.maxSize) return;
    pendingGroupRef.current = groupIndex;
    setSelection({ groupIndex, pending: true });
    setSpinToken((t) => t + 1);
  }

  function onSpinResult({ label }) {
    const groupIndex = pendingGroupRef.current;
    if (groupIndex === null || groupIndex === undefined) return;
    setGroups((prev) => {
      const copy = prev.map((g) => ({ ...g, members: [...g.members] }));
      const g = copy[groupIndex];
      if (g.members.length >= g.maxSize) return prev;
      g.members.push(label);
      return copy;
    });
    setNames((prev) => prev.filter((n) => n !== label));
    setHistory((h) => [{ groupIndex, name: label }, ...h]);
    pendingGroupRef.current = null;
  }

  function removeFromGroup(gi, mi) {
    setGroups((prev) => {
      const copy = prev.map((g) => ({ ...g, members: [...g.members] }));
      const name = copy[gi].members[mi];
      copy[gi].members.splice(mi, 1);
      setNames((n) => [...n, name]);
      return copy;
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">A Day in the Life Foundation Year Group Spinner</h1>
          <p className="text-slate-600"></p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white p-6 rounded-xl shadow-sm border">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">1) Add Names ({remaining.length})</h2>
            <div className="flex gap-2 mb-4">
              <input 
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                value={nameInput} 
                onChange={(e)=>setNameInput(e.target.value)} 
                onKeyDown={(e)=>{if(e.key==='Enter')handleAddName();}} 
                placeholder="Type a name and press Enter"
              />
              <button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors" 
                onClick={handleAddName}
              >
                Add
              </button>
            </div>
            <div className="max-h-64 overflow-auto border border-slate-200 rounded-lg">
              {remaining.length === 0 ? (
                <div className="p-4 text-center text-slate-500 italic">
                  No names added yet. Add some names to get started!
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {remaining.map((n,i)=>(
                    <li key={n+i} className="flex justify-between items-center px-3 py-2 hover:bg-slate-50">
                      <span className="text-slate-700">{n}</span>
                      <button 
                        onClick={()=>removeName(i)} 
                        className="text-rose-600 hover:text-rose-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {remaining.length > 0 && (
              <button 
                onClick={clearAllNames}
                className="mt-3 text-sm text-slate-500 hover:text-slate-700"
              >
                Clear all names
              </button>
            )}
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">2) Spin the Wheel</h2>
            <SpinnerWheel names={remaining} spinningRequest={spinToken} onResult={onSpinResult}/>
            <p className="text-sm mt-4 text-slate-600">
              {remaining.length === 0 ? "Add names to start spinning" : `${remaining.length} names remaining`}
            </p>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">3) Choose Group Split</h2>
            {suggestions.length === 0 ? (
              <div className="text-slate-500 italic text-center py-8">
                Add at least 2 names to see group options
              </div>
            ) : (
              <>
                <div className="max-h-48 overflow-auto space-y-2 mb-4">
                  {suggestions.map((opt)=>{
                    const key = opt.label;
                    return (
                      <label key={key} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input 
                          type="radio" 
                          name="split" 
                          onChange={()=>setChosenOption(opt)} 
                          checked={chosenOption===opt}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
                <button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed" 
                  disabled={!chosenOption} 
                  onClick={()=>createGroupsFromChoice(chosenOption)}
                >
                  Create Groups
                </button>
              </>
            )}
          </section>
        </div>

        {groups.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-6 text-slate-800 text-center">Your Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((g,gi)=>(
                <div key={g.id} className="bg-white p-4 rounded-xl shadow-sm border">
                  <div className="flex justify-between items-center mb-3">
                    <input 
                      className="font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none flex-1 mr-2 bg-transparent" 
                      value={customTitles[gi] ?? `${g.title} (${g.members.length}/${g.maxSize})`} 
                      onChange={(e)=>setCustomTitles(t=>({...t,[gi]:e.target.value}))}
                    />
                    <button 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed" 
                      disabled={!remaining.length || g.members.length >= g.maxSize} 
                      onClick={()=>handleSpinToGroup(gi)}
                    >
                      Add → Spin
                    </button>
                  </div>
                  <div className="space-y-2">
                    {g.members.length === 0 ? (
                      <div className="italic text-slate-400 text-center py-4">No members yet</div>
                    ) : (
                      g.members.map((m,mi)=>(
                        <div key={m+mi} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <span className="text-slate-700">{m}</span>
                          <button 
                            onClick={()=>removeFromGroup(gi,mi)} 
                            className="text-rose-600 hover:text-rose-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}