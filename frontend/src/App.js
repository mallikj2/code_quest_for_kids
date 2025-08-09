import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import axios from "axios";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import { Slider } from "./components/ui/slider";
import { Sparkles, Trophy, Play, CheckCircle2, Lightbulb, Users, Award, Settings } from "lucide-react";
import Editor from "@monaco-editor/react";
import Confetti from "react-confetti";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function useUserId() {
  const [userId, setUserId] = useState(() => localStorage.getItem("cq_user"));
  useEffect(() => {
    async function ensure() {
      if (!userId) {
        const name = "KidCoder";
        try {
          const { data } = await axios.post(`${API}/users`, { name });
          localStorage.setItem("cq_user", data.id);
          setUserId(data.id);
        } catch (e) {
          console.error(e);
        }
      }
    }
    ensure();
  }, [userId]);
  return userId;
}

function useWindowSize() {
  const [size, set] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 1024, h: typeof window !== 'undefined' ? window.innerHeight : 768 });
  useEffect(() => {
    function onResize() { set({ w: window.innerWidth, h: window.innerHeight }); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

const defaultSound = (localStorage.getItem('cq_sound') ?? 'true') === 'true';
const defaultPieces = parseInt(localStorage.getItem('cq_confetti') || '180', 10);
const defaultTheme = localStorage.getItem('cq_theme') || 'kids-light';

const Home = () => {
  const userId = useUserId();
  const [levels, setLevels] = useState([]);
  const [active, setActive] = useState("1");
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [runOut, setRunOut] = useState("");
  const [stderr, setStderr] = useState("");
  const [passed, setPassed] = useState(false);
  const [points, setPoints] = useState(0);
  const [profile, setProfile] = useState({ total_points: 0, passed_levels: [] });
  const [activeTab, setActiveTab] = useState("learn");
  const [hints, setHints] = useState([]);
  const [hintShown, setHintShown] = useState(0);
  const [runFailures, setRunFailures] = useState(0);
  const [hintCooldownUntil, setHintCooldownUntil] = useState(0);
  const [soundOn, setSoundOn] = useState(defaultSound);
  const [confettiPieces, setConfettiPieces] = useState(defaultPieces);
  const [editorTheme, setEditorTheme] = useState(defaultTheme);
  const { w, h } = useWindowSize();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await axios.get(`${API}/levels`);
        setLevels(data);
        setActive(data[0]?.id || "1");
        setCode(data[0]?.example_code || "");
        setHints(data[0]?.hints || []);
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadProgress() {
      if (!userId) return;
      const { data } = await axios.get(`${API}/users/${userId}/progress`);
      setProfile(data);
    }
    loadProgress();
  }, [userId, passed]);

  useEffect(() => {
    const lvl = levels.find(l => l.id === active);
    setHints(lvl?.hints || []);
    setHintShown(0);
    setStderr("");
    setRunFailures(0);
    if (editorRef.current && decorationsRef.current.length) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  }, [active, levels]);

  const current = useMemo(() => levels.find(l => l.id === active) || {}, [levels, active]);

  function highlightError(errorText) {
    if (!errorText || !monacoRef.current || !editorRef.current) return;
    const match = /line\s(\d+)/i.exec(errorText);
    if (match) {
      const line = parseInt(match[1], 10);
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
        {
          range: new monacoRef.current.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "bg-red-50",
            linesDecorationsClassName: "error-line-decoration",
            glyphMarginClassName: "error-glyph",
          },
        },
      ]);
    }
  }

  function playCelebrateSound() {
    if (!soundOn || typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      o.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      o.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // ignore audio errors
    }
  }

  const maxPointsThisTry = useMemo(() => {
    const base = current.points || 0;
    const decay = Math.max(0, 1 - 0.2 * hintShown);
    return Math.max(0, Math.round(base * decay));
  }, [current, hintShown]);

  async function runAndCheck() {
    if (!userId) {
      toast.error("Setting up your profile... try again in a sec");
      return;
    }
    setRunning(true);
    setRunOut("");
    setStderr("");
    try {
      const { data } = await axios.post(`${API}/execute_code`, { user_id: userId, level_id: active, code, hints_used: hintShown });
      setRunOut(data.output || "");
      setPassed(data.passed);
      setPoints(data.points_earned);
      if (data.error) setStderr(data.error);
      if (data.passed) {
        playCelebrateSound();
        toast.success(`Great job! You earned ${data.points_earned} points`);
        setRunFailures(0);
      } else if (data.error) {
        toast("There's an error in your code. Check the highlighted line.");
        highlightError(data.error);
        setRunFailures((n) => n + 1);
      } else {
        toast("Keep trying! Read the hint again.");
        setRunFailures((n) => n + 1);
      }
    } catch (e) {
      toast.error("Run failed. Please try again.");
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

  // Topics badges derived from passed levels
  const topicBadges = useMemo(() => {
    const passedSet = new Set(profile.passed_levels || []);
    const topics = new Set();
    for (const l of levels) {
      if (passedSet.has(l.id)) topics.add(l.topic);
    }
    return Array.from(topics);
  }, [profile, levels]);

  const onEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // themes
    monaco.editor.defineTheme('kids-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editorLineNumber.foreground': '#94a3b8',
        'editor.lineHighlightBackground': '#f1f5f9',
        'editor.selectionBackground': '#dbeafe',
      }
    });
    monaco.editor.defineTheme('midnight', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0b1220',
        'editor.lineHighlightBackground': '#111827',
      }
    });
    editor.updateOptions({ fontSize: 17, minimap: { enabled: false }, wordWrap: 'on' });
    monaco.editor.setTheme(editorTheme === 'dyslexic' ? 'kids-light' : editorTheme);
    // Dyslexic-friendly tweaks
    if (editorTheme === 'dyslexic') {
      editor.updateOptions({ fontFamily: 'Atkinson Hyperlegible, Source Code Pro, ui-monospace, monospace', letterSpacing: 0.5, lineHeight: 24 });
    }
    // Hotkey: Run (Cmd/Ctrl + Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runAndCheck();
    });
  };

  useEffect(() => {
    // persist settings
    localStorage.setItem('cq_sound', String(soundOn));
  }, [soundOn]);
  useEffect(() => {
    localStorage.setItem('cq_confetti', String(confettiPieces));
  }, [confettiPieces]);
  useEffect(() => {
    localStorage.setItem('cq_theme', editorTheme);
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(editorTheme === 'dyslexic' ? 'kids-light' : editorTheme);
      if (editorRef.current) {
        if (editorTheme === 'dyslexic') {
          editorRef.current.updateOptions({ fontFamily: 'Atkinson Hyperlegible, Source Code Pro, ui-monospace, monospace', letterSpacing: 0.5, lineHeight: 24 });
        } else {
          editorRef.current.updateOptions({ fontFamily: 'Source Code Pro, ui-monospace, monospace', letterSpacing: 0, lineHeight: 20 });
        }
      }
    }
  }, [editorTheme]);

  const canShowHint = () => Date.now() >= hintCooldownUntil && hintShown < hints.length;
  const revealHint = () => {
    if (!canShowHint()) return;
    setHintShown((n) => Math.min(n + 1, hints.length));
    const cooldownMs = 8000; // 8s cooldown
    setHintCooldownUntil(Date.now() + cooldownMs);
  };

  const needHintPrompt = runFailures >= 2 && hintShown < hints.length;
  const cooldownRemainingSec = Math.max(0, Math.ceil((hintCooldownUntil - Date.now()) / 1000));

  return (
    <div className="min-h-screen bg-[rgb(245,247,252)]">
      <Toaster />
      {passed && <Confetti width={w} height={h} numberOfPieces={confettiPieces} gravity={0.25} recycle={false} />}
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div><Sparkles size={28} className="text-indigo-700" /></div>
            <h1 className="text-2xl font-[Montserrat] tracking-tight text-slate-900">CodeQuest Kids</h1>
            <Badge className="ml-3 bg-slate-900 text-white">Python</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="flex items-center gap-2"><Settings size={16}/> Settings</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium">Editor theme</div>
                    <Select value={editorTheme} onValueChange={setEditorTheme}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Theme" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kids-light">Kids Light</SelectItem>
                        <SelectItem value="midnight">Midnight</SelectItem>
                        <SelectItem value="dyslexic">Dyslexia-friendly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Sound on pass</div>
                    <Switch checked={soundOn} onCheckedChange={setSoundOn} />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Celebration intensity</div>
                    <Slider defaultValue={[confettiPieces]} min={60} max={300} step={10} onValueChange={(v)=>setConfettiPieces(v[0])} />
                    <div className="text-xs text-slate-500 mt-1">Pieces: {confettiPieces}</div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {topicBadges.map((t) => (
              <Badge key={t} className="bg-emerald-600">{t}</Badge>
            ))}
            <div className="hidden sm:flex items-center gap-2"><Trophy size={18}/> {profile.total_points} pts</div>
            <div className="hidden sm:flex items-center gap-2"><CheckCircle2 size={18}/> {profile.passed_levels?.length || 0}/10</div>
            <Link to="/badges" className="text-slate-700 hover:underline flex items-center gap-2"><Award size={18}/> Badges</Link>
            <Link to="/dashboard" className="text-slate-700 hover:underline flex items-center gap-2"><Users size={18}/> Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 space-y-4">
          <Card className="shadow-xl border-slate-200">
            <CardHeader>
              <CardTitle className="font-[Montserrat] text-slate-900">Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {levels.map((lvl) => (
                  <button key={lvl.id} onClick={() => { setActive(lvl.id); setCode(lvl.example_code); setRunOut(""); setPassed(false); }}
                          className={`w-full text-left px-4 py-3 rounded-lg border hover:border-slate-400 transition-colors ${active===lvl.id?"bg-white border-slate-300":"bg-slate-50 border-transparent"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{lvl.id}. {lvl.title}</div>
                        <div className="text-xs text-slate-500">{lvl.topic}</div>
                      </div>
                      {profile.passed_levels?.includes(lvl.id) && (
                        <Badge className="bg-green-600">Done</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="lg:col-span-8 space-y-4">
          <Card className="shadow-xl border-slate-200">
            <CardHeader>
              <CardTitle className="font-[Montserrat] text-slate-900">{current.title || ""}</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="learn">Learn</TabsTrigger>
                  <TabsTrigger value="try">Try it</TabsTrigger>
                  <TabsTrigger value="output">Output</TabsTrigger>
                </TabsList>
                <TabsContent value="learn">
                  <div className="prose max-w-none text-slate-800">
                    <p className="mb-3 text-slate-700">{current.tutorial}</p>
                    <div className="bg-slate-900 text-slate-50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap">{current.example_code}</div>
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">Challenge: {current.challenge}</div>
                    <div className="mt-3">
                      <div className="flex items-center gap-3">
                        <Button variant="secondary" disabled={!canShowHint()} onClick={revealHint}><Lightbulb className="mr-2" size={16}/>Show hint ({hintShown}/{hints.length})</Button>
                        {cooldownRemainingSec > 0 && (<span className="text-xs text-slate-500">Wait {cooldownRemainingSec}s</span>)}
                      </div>
                      <ul className="mt-2 list-disc list-inside text-slate-700">
                        {hints.slice(0, hintShown).map((h, i) => (<li key={i}>{h}</li>))}
                      </ul>
                      {hintShown > 0 && (
                        <div className="text-xs text-slate-500 mt-2">Using hints reduces points for this attempt.</div>
                      )}
                      {needHintPrompt && (
                        <div className="mt-3 bg-slate-50 border rounded p-3 text-sm">
                          Stuck after a few tries? Would you like a hint?
                          <Button className="ml-3" size="sm" variant="secondary" onClick={revealHint}>Reveal hint</Button>
                        </div>
                      )}
                      <div className="text-sm text-slate-600 mt-3">Points this try: <span className="font-semibold">{maxPointsThisTry}</span></div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="try">
                  <div className="space-y-3">
                    {Editor ? (
                      <div className="rounded-lg border overflow-hidden">
                        <Editor height="260px" defaultLanguage="python" value={code} onChange={(v)=>setCode(v || "")} theme={editorTheme === 'dyslexic' ? 'kids-light' : editorTheme} onMount={onEditorMount} options={{ fontSize: 17, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on' }} />
                      </div>
                    ) : (
                      <Textarea className="min-h-[220px] font-mono" value={code} onChange={(e)=>setCode(e.target.value)} placeholder="Type your Python code here..."/>
                    )}
                    <div className="flex items-center gap-3">
                      <Button disabled={running} onClick={runAndCheck} className="bg-slate-900 text-white hover:bg-slate-800"><Play className="mr-2" size={16}/>Run &amp; Check</Button>
                      <Button variant="secondary" onClick={()=>setCode(current.example_code || "")}>Reset</Button>
                      <div className="text-xs text-slate-500">Max points now: {maxPointsThisTry}</div>
                    </div>
                    <Progress value={passed?100: (runOut?40:0)} />
                  </div>
                </TabsContent>
                <TabsContent value="output">
                  <div className="bg-white border rounded-lg p-4 min-h-[140px] font-mono text-sm whitespace-pre-wrap">{stderr ? stderr : (runOut || "Your program output will appear here.")}</div>
                  {passed && (
                    <div className="mt-3 flex items-center gap-2 text-green-700"><CheckCircle2 size={18}/> You earned {points} points!</div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="py-10 border-t bg-white/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 text-sm text-slate-500">Made for curious minds. Be kind and keep coding.</div>
      </footer>
    </div>
  );
};

const Badges = () => {
  const userId = useUserId();
  const [levels, setLevels] = useState([]);
  const [profile, setProfile] = useState({ total_points: 0, passed_levels: [] });

  useEffect(() => {
    async function load() {
      const [lvls, prof] = await Promise.all([
        axios.get(`${API}/levels`),
        userId ? axios.get(`${API}/users/${userId}/progress`) : Promise.resolve({ data: { passed_levels: [] } }),
      ]);
      setLevels(lvls.data);
      setProfile(prof.data);
    }
    load();
  }, [userId]);

  const topics = Array.from(new Set(levels.map(l => l.topic)));
  const unlocked = new Set(
    (profile.passed_levels || []).map(id => (levels.find(l => l.id === id) || {}).topic)
  );

  return (
    <div className="min-h-screen bg-[rgb(245,247,252)]">
      <Toaster />
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div><Award size={24} className="text-indigo-700" /></div>
            <h1 className="text-2xl font-[Montserrat] tracking-tight text-slate-900">Badge Cabinet</h1>
          </div>
          <Link to="/" className="text-slate-700 hover:underline">Back to App</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topics.map((t) => {
          const isOn = unlocked.has(t);
          return (
            <Card key={t} className={`border ${isOn ? 'border-emerald-300' : 'border-slate-200 opacity-70'}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={isOn? 'bg-emerald-600' : ''}>{t}</Badge>
                  {isOn ? 'Unlocked' : 'Locked'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">Earn this badge by completing a level in the {t} track.</p>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({ leaderboard: [], total_users: 0, total_points: 0, badges: {} });

  useEffect(() => {
    async function load() {
      try {
        const [u, s] = await Promise.all([
          axios.get(`${API}/admin/users`),
          axios.get(`${API}/admin/summary`),
        ]);
        setUsers(u.data);
        setSummary(s.data);
      } catch (e) {
        toast.error("Failed to load dashboard");
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[rgb(245,247,252)]">
      <Toaster />
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div><Users size={24} className="text-indigo-700" /></div>
            <h1 className="text-2xl font-[Montserrat] tracking-tight text-slate-900">Class Dashboard</h1>
          </div>
          <Link to="/" className="text-slate-700 hover:underline">Back to App</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardHeader><CardTitle>Total Users</CardTitle></CardHeader><CardContent className="text-2xl">{summary.total_users}</CardContent></Card>
          <Card><CardHeader><CardTitle>Total Points</CardTitle></CardHeader><CardContent className="text-2xl">{summary.total_points}</CardContent></Card>
          <Card><CardHeader><CardTitle>Top Student</CardTitle></CardHeader><CardContent className="text-sm">{summary.leaderboard?.[0]?.name || '-'}</CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Leaderboard</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Levels</TableHead>
                  <TableHead>Badges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.leaderboard.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.points}</TableCell>
                    <TableCell>{row.levels_passed}</TableCell>
                    <TableCell>
                      {(summary.badges?.[row.user_id] || []).map((b) => (
                        <Badge key={b} className="mr-2 mb-1">{b}</Badge>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/badges" element={<Badges />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;