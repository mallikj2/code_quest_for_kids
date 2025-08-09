import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import axios from "axios";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// animations kept subtle with CSS; no external motion lib to avoid extra deps
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Toaster, toast } from "./components/ui/sonner";
import { Input } from "./components/ui/input";
import { Sparkles, Trophy, Play, CheckCircle2 } from "lucide-react";

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

const Home = () => {
  const userId = useUserId();
  const [levels, setLevels] = useState([]);
  const [active, setActive] = useState("1");
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [runOut, setRunOut] = useState("");
  const [passed, setPassed] = useState(false);
  const [points, setPoints] = useState(0);
  const [profile, setProfile] = useState({ total_points: 0, passed_levels: [] });

  useEffect(() => {
    async function load() {
      try {
        const { data } = await axios.get(`${API}/levels`);
        setLevels(data);
        setActive(data[0]?.id || "1");
        setCode(data[0]?.example_code || "");
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

  const current = useMemo(() => levels.find(l => l.id === active) || {}, [levels, active]);

  async function runAndCheck() {
    if (!userId) {
      toast.error("Setting up your profile... try again in a sec");
      return;
    }
    setRunning(true);
    setRunOut("");
    try {
      const { data } = await axios.post(`${API}/execute_code`, { user_id: userId, level_id: active, code });
      setRunOut(data.output || "");
      setPassed(data.passed);
      setPoints(data.points_earned);
      if (data.passed) {
        toast.success("Great job! Challenge passed");
      } else {
        toast("Keep trying! Read the hint again.");
      }
    } catch (e) {
      toast.error("Run failed. Please try again.");
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(245,247,252)]">
      <Toaster />
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}>
              <Sparkles size={28} className="text-indigo-700" />
            </motion.div>
            <h1 className="text-2xl font-[Montserrat] tracking-tight text-slate-900">CodeQuest Kids</h1>
            <Badge className="ml-3 bg-slate-900 text-white">Python</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="hidden sm:flex items-center gap-2"><Trophy size={18}/> {profile.total_points} pts</div>
            <div className="hidden sm:flex items-center gap-2"><CheckCircle2 size={18}/> {profile.passed_levels?.length || 0}/10</div>
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
                  <button key={lvl.id} onClick={() => { setActive(lvl.id); setCode(lvl.example_code); setRunOut(""); }}
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
              <Tabs value="learn">
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
                  </div>
                </TabsContent>
                <TabsContent value="try">
                  <div className="space-y-3">
                    <Textarea className="min-h-[220px] font-mono" value={code} onChange={(e)=>setCode(e.target.value)} placeholder="Type your Python code here..."/>
                    <div className="flex gap-3">
                      <Button disabled={running} onClick={runAndCheck} className="bg-slate-900 text-white hover:bg-slate-800"><Play className="mr-2" size={16}/>Run &amp; Check</Button>
                      <Button variant="secondary" onClick={()=>setCode(current.example_code || "")}>Reset</Button>
                    </div>
                    <Progress value={passed?100: (runOut?40:0)} />
                  </div>
                </TabsContent>
                <TabsContent value="output">
                  <div className="bg-white border rounded-lg p-4 min-h-[140px] font-mono text-sm whitespace-pre-wrap">{runOut || "Your program output will appear here."}</div>
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

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;