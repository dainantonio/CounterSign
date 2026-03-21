'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  ArrowRightLeft, 
  Copy, 
  Check,
  Loader2,
  Settings as SettingsIcon,
  MapPin,
  Clock,
  DollarSign,
  FileText,
  Trash2,
  ChevronRight,
  Sparkles,
  Zap,
  X,
  Save
} from 'lucide-react';
import { analyzeJobOffer, DEFAULT_SETTINGS, PricingSettings } from '@/lib/ai';

interface AnalysisResult {
  id: string;
  job_detected: boolean;
  decision: 'ACCEPT' | 'COUNTER' | 'DECLINE';
  recommended_fee: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
  professional_justification?: string;
  response_message: string;
  action_type: 'AUTO_SEND' | 'DRAFT' | 'REVIEW';
  status: 'new' | 'reviewed' | 'completed';
  timestamp: number;
  notes?: string;
  parsed_input: {
    offered_fee: number;
    distance_miles: number;
    time_type: 'standard' | 'after_hours';
    document_type: 'refinance' | 'purchase' | 'general';
    page_count: number;
    requires_scanbacks: boolean;
    is_short_notice?: boolean;
  };
  overhead: {
    base_overhead?: number;
    travel_cost: number;
    printing_cost: number;
    time_cost: number;
    scanback_cost: number;
    total_expenses: number;
    net_profit: number;
    hourly_net_profit?: number;
    is_low_margin?: boolean;
  };
}

type AppMode = 'Guide' | 'Agent (Draft)' | 'Agent (Auto)';

export default function PricingAssistant() {
  const [offerText, setOfferText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<AppMode>('Guide');
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');

  const [isNotifying, setIsNotifying] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [jobs, setJobs] = useState<AnalysisResult[]>([]);

  const activeJob = jobs.find(j => j.id === activeJobId) || null;

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);

  // Load data from localStorage on mount
  React.useEffect(() => {
    const savedJobs = localStorage.getItem('notary_job_history');
    if (savedJobs) {
      try {
        setJobs(JSON.parse(savedJobs));
      } catch (e) {
        console.error('Failed to parse saved jobs');
      }
    }

    const savedSettings = localStorage.getItem('notary_pricing_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse saved settings');
      }
    }
    setMounted(true);
  }, []);

  const saveSettings = (newSettings: PricingSettings) => {
    setSettings(newSettings);
    localStorage.setItem('notary_pricing_settings', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const updateJobNotes = (id: string, notes: string) => {
    const updated = jobs.map(j => j.id === id ? { ...j, notes } : j);
    setJobs(updated);
    localStorage.setItem('notary_job_history', JSON.stringify(updated));
  };

  const handleAnalyze = async () => {
    if (!offerText.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    setNotificationSent(false);

    try {
      const analysis = await analyzeJobOffer(offerText, settings);
      const newJob: AnalysisResult = {
        ...analysis,
        id: Math.random().toString(36).substr(2, 9),
        status: 'new',
        timestamp: Date.now()
      };
      
      const newJobs = [newJob, ...jobs].slice(0, 20);
      setJobs(newJobs);
      setActiveJobId(newJob.id);
      setEditedMessage(newJob.response_message);
      localStorage.setItem('notary_job_history', JSON.stringify(newJobs));
      setOfferText('');

      // Auto-mode logic
      if (mode === 'Agent (Auto)' && newJob.decision === 'ACCEPT' && newJob.confidence === 'HIGH') {
        handleNotify(newJob);
      }
    } catch (err) {
      setError('Failed to analyze the job offer. Please try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateJobStatus = (id: string, status: AnalysisResult['status']) => {
    const newJobs = jobs.map(j => j.id === id ? { ...j, status } : j);
    setJobs(newJobs);
    localStorage.setItem('notary_job_history', JSON.stringify(newJobs));
  };

  const handleNotify = async (job: AnalysisResult) => {
    setIsNotifying(true);
    try {
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (response.ok) {
        setNotificationSent(true);
        updateJobStatus(job.id, 'completed');
      } else {
        setError('Failed to send notification. Please check your API key.');
      }
    } catch (err) {
      setError('An error occurred while sending the notification.');
    } finally {
      setIsNotifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const removeFromHistory = (id: string) => {
    const newJobs = jobs.filter(j => j.id !== id);
    setJobs(newJobs);
    if (activeJobId === id) setActiveJobId(null);
    localStorage.setItem('notary_job_history', JSON.stringify(newJobs));
  };

  const getDecisionStyles = (decision: string) => {
    switch (decision) {
      case 'ACCEPT':
        return {
          bg: 'bg-emerald-50 border-emerald-200',
          text: 'text-emerald-700',
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
          accent: 'bg-emerald-500'
        };
      case 'COUNTER':
        return {
          bg: 'bg-amber-50 border-amber-200',
          text: 'text-amber-700',
          icon: <ArrowRightLeft className="w-6 h-6 text-amber-500" />,
          accent: 'bg-amber-500'
        };
      case 'DECLINE':
        return {
          bg: 'bg-rose-50 border-rose-200',
          text: 'text-rose-700',
          icon: <XCircle className="w-6 h-6 text-rose-500" />,
          accent: 'bg-rose-500'
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200',
          text: 'text-slate-700',
          icon: <AlertCircle className="w-6 h-6 text-slate-500" />,
          accent: 'bg-slate-500'
        };
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-black/20">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-display font-black tracking-tight text-slate-900 leading-none">
              SIGNATURE SEAL AI
            </h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operations Dashboard</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live Sync</span>
          </div>

          <div className="flex items-center gap-2">
            <select 
              value={mode}
              onChange={(e) => setMode(e.target.value as AppMode)}
              className="bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-black/5 cursor-pointer outline-none transition-all hover:bg-slate-200"
            >
              <option value="Guide">Guide Mode</option>
              <option value="Agent (Draft)">Agent Mode (Draft)</option>
              <option value="Agent (Auto)">Agent Mode (Auto)</option>
            </select>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel: Inbox */}
        <aside className={`
          absolute inset-0 z-20 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300
          lg:relative lg:translate-x-0 lg:w-80 xl:w-96
          ${activeJobId ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        `}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Incoming Jobs</h2>
            <button 
              onClick={() => setJobs([])}
              className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
              title="Clear History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Manual Entry Input */}
            <div className="relative group">
              <textarea
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                placeholder="Paste job offer text..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:bg-white focus:border-black outline-none transition-all resize-none h-28 shadow-inner"
              />
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !offerText.trim()}
                className="absolute bottom-3 right-3 p-2.5 bg-black text-white rounded-xl disabled:opacity-50 shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>

            {jobs.length === 0 && !isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <Calculator className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-400">No incoming jobs detected yet.</p>
              </div>
            )}

            {jobs.map((job) => (
              <motion.button
                layout
                key={job.id}
                onClick={() => {
                  setActiveJobId(job.id);
                  setEditedMessage(job.response_message);
                  setEditedNotes(job.notes || '');
                  setIsEditingNotes(false);
                  if (job.status === 'new') updateJobStatus(job.id, 'reviewed');
                }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all group relative overflow-hidden ${
                  activeJobId === job.id 
                  ? 'bg-black border-black shadow-xl shadow-black/20' 
                  : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
                whileHover={{ scale: activeJobId === job.id ? 1 : 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {activeJobId === job.id && (
                  <>
                    <motion.div 
                      layoutId="activeIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-white z-20"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8" />
                  </>
                )}
                
                <div className="flex items-start justify-between mb-3 relative z-10 pl-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      job.status === 'new' ? 'bg-rose-500 animate-pulse' : 
                      job.status === 'reviewed' ? 'bg-amber-500' : 'bg-slate-300'
                    }`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${activeJobId === job.id ? 'text-white/60' : 'text-slate-400'}`}>
                      {job.parsed_input.document_type}
                    </span>
                  </div>
                  <span className={`text-base font-display font-black ${activeJobId === job.id ? 'text-white' : 'text-slate-900'}`}>
                    ${job.parsed_input.offered_fee}
                  </span>
                </div>

                <div className={`flex items-center gap-3 text-[11px] font-bold relative z-10 ${activeJobId === job.id ? 'text-white/80' : 'text-slate-500'}`}>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.parsed_input.distance_miles} mi
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {job.parsed_input.time_type.replace('_', ' ')}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between relative z-10">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
                    activeJobId === job.id 
                    ? 'bg-white/20 text-white' 
                    : getDecisionStyles(job.decision).bg + ' ' + getDecisionStyles(job.decision).text
                  }`}>
                    {job.decision}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold ${activeJobId === job.id ? 'text-white/40' : 'text-slate-400'}`}>
                      {new Date(job.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <ChevronRight className={`w-3 h-3 transition-transform ${activeJobId === job.id ? 'text-white translate-x-1' : 'text-slate-300'}`} />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </aside>

        {/* Right Panel: Job Detail + AI Recommendation */}
        <main className={`
          flex-1 flex flex-col bg-slate-50 overflow-y-auto transition-transform duration-300
          ${activeJobId ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          {activeJob ? (
            <div className="max-w-3xl mx-auto w-full p-4 md:p-8 space-y-6">
              {/* Mobile Back Button */}
              <button 
                onClick={() => setActiveJobId(null)}
                className="lg:hidden flex items-center gap-2 text-slate-400 font-bold text-xs uppercase mb-4"
              >
                <X className="w-4 h-4" /> Back to Inbox
              </button>

              {/* Section 1: Job Summary - Bento Grid Style */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Job Analysis</h3>
                  <button 
                    onClick={() => removeFromHistory(activeJob.id)}
                    className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Document</p>
                      <p className="text-sm font-display font-black text-slate-900 capitalize">{activeJob.parsed_input.document_type}</p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Offered</p>
                      <p className="text-sm font-display font-black text-slate-900">${activeJob.parsed_input.offered_fee}</p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Distance</p>
                      <p className="text-sm font-display font-black text-slate-900">{activeJob.parsed_input.distance_miles} mi</p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                    <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Time</p>
                      <p className="text-sm font-display font-black text-slate-900 capitalize">{activeJob.parsed_input.time_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Real-Time Overhead HUD */}
              <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Overhead HUD</h3>
                    <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      (activeJob.overhead?.net_profit ?? 0) < 0 ? 'bg-rose-50 text-rose-600' :
                      (activeJob.overhead?.hourly_net_profit ?? 0) < 20 ? 'bg-amber-50 text-amber-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      { (activeJob.overhead?.net_profit ?? 0) < 0 ? '🔴 LOSS' :
                        (activeJob.overhead?.hourly_net_profit ?? 0) < 20 ? '🟡 BREAK-EVEN' :
                        '🟢 PROFITABLE' }
                    </div>
                    {activeJob.overhead?.is_low_margin && (
                      <div className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Low Margin
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Expenses</span>
                    <span className="text-xl font-display font-black text-slate-900">${(activeJob.overhead?.total_expenses ?? 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Base Overhead</span>
                    <span className="text-sm font-bold text-slate-700">${(activeJob.overhead?.base_overhead ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Travel (IRS)</span>
                    <span className="text-sm font-bold text-slate-700">${(activeJob.overhead?.travel_cost ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Printing</span>
                    <span className="text-sm font-bold text-slate-700">${(activeJob.overhead?.printing_cost ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Time Value</span>
                    <span className="text-sm font-bold text-slate-700">${(activeJob.overhead?.time_cost ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Scanbacks</span>
                    <span className="text-sm font-bold text-slate-700">${(activeJob.overhead?.scanback_cost ?? 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">AI Justification</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed italic">
                    &ldquo;{activeJob.professional_justification || activeJob.reasoning}&rdquo;
                  </p>
                </div>
              </section>

              {/* Section 3: AI Recommendation - Hero Style */}
              <section className={`rounded-[2.5rem] p-10 border-2 shadow-2xl relative overflow-hidden ${getDecisionStyles(activeJob.decision).bg}`}>
                <div className={`absolute top-0 right-0 w-64 h-64 -mr-16 -mt-16 rounded-full opacity-10 blur-3xl ${getDecisionStyles(activeJob.decision).accent}`} />
                <div className={`absolute bottom-0 left-0 w-32 h-32 -ml-8 -mb-8 rounded-full opacity-5 blur-2xl ${getDecisionStyles(activeJob.decision).accent}`} />
                
                <div className="relative z-10 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-2xl shadow-sm">
                        {getDecisionStyles(activeJob.decision).icon}
                      </div>
                      <div>
                        <span className={`text-4xl font-display font-black tracking-tighter uppercase ${getDecisionStyles(activeJob.decision).text}`}>
                          {activeJob.decision}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Sparkles className={`w-3 h-3 ${getDecisionStyles(activeJob.decision).text} opacity-50`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${getDecisionStyles(activeJob.decision).text} opacity-60`}>AI Recommendation</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-2 bg-white/40 backdrop-blur-md rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] text-slate-600 border border-white/30 shadow-sm">
                      {activeJob.confidence} Confidence
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${getDecisionStyles(activeJob.decision).text} opacity-50`}>Suggested Fee</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-display font-black text-slate-400">$</span>
                          <p className="text-8xl font-display font-black text-slate-900 tracking-tighter leading-none">{activeJob.recommended_fee}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          const text = `Fair Fee: $${activeJob.recommended_fee}\nReason: ${activeJob.professional_justification || activeJob.reasoning}`;
                          navigator.clipboard.writeText(text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/50 hover:bg-white/80 backdrop-blur-sm rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 transition-all border border-white/30"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied to Clipboard' : 'Copy Fair Fee & Reason'}
                      </button>
                    </div>
                    
                    {/* Section 3: Reasoning */}
                    <div className="max-w-xs bg-white/30 backdrop-blur-sm p-5 rounded-2xl border border-white/20">
                      <p className="text-xs leading-relaxed text-slate-700 font-bold italic">
                        &ldquo;{activeJob.reasoning}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Response Message */}
              <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Response Message</h3>
                    {mode !== 'Guide' && (
                      <span className="px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase tracking-widest rounded-full">Draft</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingMessage(!isEditingMessage)}
                      className={`p-2 rounded-xl transition-all ${isEditingMessage ? 'bg-black text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                      title="Edit Message"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(editedMessage)}
                      className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                      title="Copy Message"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isEditingMessage ? (
                  <textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-mono leading-relaxed focus:ring-4 focus:ring-black/5 focus:border-black outline-none h-40 transition-all"
                  />
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                    <p className="text-sm text-slate-700 leading-relaxed font-mono break-words">
                      {editedMessage}
                    </p>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition-colors pointer-events-none rounded-2xl" />
                  </div>
                )}
              </section>

              {/* Section: Private Notes */}
              <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Private Notes</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditingNotes ? (
                      <button
                        onClick={() => {
                          updateJobNotes(activeJob.id, editedNotes);
                          setIsEditingNotes(false);
                        }}
                        className="p-2 bg-black text-white rounded-xl transition-all shadow-lg shadow-black/10"
                        title="Save Notes"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                        title="Edit Notes"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditingNotes ? (
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    placeholder="Add private notes about this job..."
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm leading-relaxed focus:ring-4 focus:ring-black/5 focus:border-black outline-none h-32 transition-all"
                  />
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 min-h-[80px]">
                    {activeJob.notes ? (
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {activeJob.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        No private notes added yet.
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Section 5: Action Buttons */}
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => handleNotify({ ...activeJob, response_message: editedMessage, decision: 'COUNTER' })}
                  disabled={isNotifying || activeJob.status === 'completed'}
                  className={`sm:col-span-1 flex items-center justify-center gap-3 px-6 py-5 rounded-[1.5rem] font-display font-black uppercase tracking-wider text-xs transition-all shadow-xl disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] ${
                    activeJob.decision === 'COUNTER' && (mode === 'Agent (Draft)' || mode === 'Agent (Auto)')
                    ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/30'
                    : 'bg-white border-2 border-slate-100 text-slate-900 hover:border-slate-300 shadow-slate-200/50'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {activeJob.decision === 'COUNTER' && mode !== 'Guide' ? 'Confirm Counter' : 'Send Counter'}
                </button>
                <button
                  onClick={() => handleNotify({ ...activeJob, response_message: editedMessage, decision: 'ACCEPT' })}
                  disabled={isNotifying || activeJob.status === 'completed'}
                  className={`sm:col-span-1 flex items-center justify-center gap-3 px-6 py-5 rounded-[1.5rem] font-display font-black uppercase tracking-wider text-xs transition-all shadow-xl disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] ${
                    activeJob.decision === 'ACCEPT' && (mode === 'Agent (Draft)' || mode === 'Agent (Auto)')
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30'
                    : 'bg-white border-2 border-slate-100 text-slate-900 hover:border-slate-300 shadow-slate-200/50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {activeJob.decision === 'ACCEPT' && mode !== 'Guide' ? 'Confirm Accept' : 'Accept As-Is'}
                </button>
                <button
                  onClick={() => handleNotify({ ...activeJob, response_message: editedMessage, decision: 'DECLINE' })}
                  disabled={isNotifying || activeJob.status === 'completed'}
                  className={`sm:col-span-1 flex items-center justify-center gap-3 px-6 py-5 rounded-[1.5rem] font-display font-black uppercase tracking-wider text-xs transition-all shadow-xl disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] ${
                    activeJob.decision === 'DECLINE' && (mode === 'Agent (Draft)' || mode === 'Agent (Auto)')
                    ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/30'
                    : 'bg-white border-2 border-slate-100 text-slate-900 hover:border-slate-300 shadow-slate-200/50'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  {activeJob.decision === 'DECLINE' && mode !== 'Guide' ? 'Confirm Decline' : 'Decline'}
                </button>
              </section>

              {notificationSent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-5 h-5" />
                  Action Logged Successfully
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-white rounded-full shadow-xl shadow-slate-200/50 flex items-center justify-center mb-4">
                <Calculator className="w-8 h-8 text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Select a job to review</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Choose an incoming job from the left panel to see AI pricing recommendations and take action.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-900">Pricing Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-5 md:p-8 space-y-8 overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Fee Structure</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Base Fee ($)</label>
                      <input
                        type="number"
                        value={settings.baseFee}
                        onChange={(e) => setSettings({ ...settings, baseFee: Number(e.target.value) })}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-base font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mileage Rate ($/mi)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.mileageRate}
                        onChange={(e) => setSettings({ ...settings, mileageRate: Number(e.target.value) })}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-base font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">After Hours</label>
                      <input
                        type="number"
                        value={settings.afterHoursFee}
                        onChange={(e) => setSettings({ ...settings, afterHoursFee: Number(e.target.value) })}
                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Refinance</label>
                      <input
                        type="number"
                        value={settings.refinanceFee}
                        onChange={(e) => setSettings({ ...settings, refinanceFee: Number(e.target.value) })}
                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Purchase</label>
                      <input
                        type="number"
                        value={settings.purchaseFee}
                        onChange={(e) => setSettings({ ...settings, purchaseFee: Number(e.target.value) })}
                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-6">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Overhead HUD Config</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">IRS Mileage ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={settings.irsMileageRate}
                          onChange={(e) => setSettings({ ...settings, irsMileageRate: Number(e.target.value) })}
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Printing ($/pg)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={settings.printingRate}
                          onChange={(e) => setSettings({ ...settings, printingRate: Number(e.target.value) })}
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hourly Rate ($)</label>
                        <input
                          type="number"
                          value={settings.hourlyRate}
                          onChange={(e) => setSettings({ ...settings, hourlyRate: Number(e.target.value) })}
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Scanback Fee ($)</label>
                        <input
                          type="number"
                          value={settings.scanbackFee}
                          onChange={(e) => setSettings({ ...settings, scanbackFee: Number(e.target.value) })}
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Min Hourly Profit ($)</label>
                        <input
                          type="number"
                          value={settings.minHourlyNetProfit}
                          onChange={(e) => setSettings({ ...settings, minHourlyNetProfit: Number(e.target.value) })}
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Base Overhead ($)</label>
                        <input
                          type="number"
                          value={settings.baseOverhead}
                          onChange={(e) => setSettings({ ...settings, baseOverhead: Number(e.target.value) })}
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Message Templates</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Accept Template</label>
                      <textarea
                        value={settings.templates.ACCEPT}
                        onChange={(e) => setSettings({ ...settings, templates: { ...settings.templates, ACCEPT: e.target.value } })}
                        rows={2}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Counter Template</label>
                      <textarea
                        value={settings.templates.COUNTER}
                        onChange={(e) => setSettings({ ...settings, templates: { ...settings.templates, COUNTER: e.target.value } })}
                        rows={3}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Decline Template</label>
                      <textarea
                        value={settings.templates.DECLINE}
                        onChange={(e) => setSettings({ ...settings, templates: { ...settings.templates, DECLINE: e.target.value } })}
                        rows={2}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition-all text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 md:p-8 bg-white border-t border-slate-100 shrink-0">
                <button
                  onClick={() => saveSettings(settings)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-black text-white rounded-2xl font-display font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all shadow-xl shadow-black/20 active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
