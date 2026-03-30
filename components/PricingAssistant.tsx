'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calculator, AlertCircle, CheckCircle2, XCircle, ArrowRightLeft,
  Copy, Check, Loader2, Settings as SettingsIcon, MapPin, Clock,
  DollarSign, FileText, Trash2, ChevronRight, Sparkles, Zap, X, Save,
  ShieldAlert, ShieldX, TriangleAlert, BadgeCheck, CircleHelp,
  MessageSquareWarning, GitMerge, ChevronDown, ChevronUp,
} from 'lucide-react';
import { analyzeJobOfferFast, analyzeJobOfferFull, DEFAULT_SETTINGS, PricingSettings } from '@/lib/ai';

// ─── Types ───────────────────────────────────────────────────────────
type AuditStatus = 'PRESENT' | 'MISSING' | 'VAGUE';
type Decision = 'ACCEPT' | 'COUNTER' | 'DECLINE' | 'REVIEW' | 'CONDITIONAL_COUNTER' | 'RATE_QUOTE';
type MessageType = 'job_offer' | 'pre_offer_inquiry' | 'partial_inquiry' | 'other';

interface OfferAudit {
  fields: Record<string, AuditStatus>;
  completeness_score: number;
  completeness_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  critical_missing: string[];
  risk_flags: string[];
  schedule_conflict_warning: string | null;
  lsa_accountability_note: string | null;
}

interface AnalysisResult {
  id: string;
  message_type: MessageType;
  job_detected: boolean;
  is_urgent: boolean;
  primary_action: string;
  decision: Decision;
  conditions_required: string[];
  recommended_fee: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  estimated_fields: string[];
  fee_data_quality: 'HIGH' | 'MEDIUM' | 'LOW';
  fee_data_quality_note: string | null;
  reasoning: string;
  professional_justification?: string;
  response_message: string;
  rate_inquiry_response: string | null;
  action_type: 'AUTO_SEND' | 'DRAFT' | 'REVIEW';
  status: 'new' | 'reviewed' | 'completed';
  auditLoading: boolean;
  timestamp: number;
  notes?: string;
  offer_audit: OfferAudit;
  parsed_input: {
    offered_fee: number | null;
    distance_miles: number;
    time_type: 'standard' | 'after_hours';
    document_type: 'refinance' | 'purchase' | 'general';
    page_count: number;
    requires_scanbacks: boolean | null;
    is_short_notice: boolean;
    appointment_time: string | null;
    appointment_date: string | null;
    signing_address: string | null;
    dropoff_required: boolean | null;
    dropoff_same_day: boolean | null;
    lsa_name: string | null;
  };
  overhead: {
    base_overhead: number;
    travel_cost: number;
    printing_cost: number;
    time_cost: number;
    scanback_cost: number;
    total_expenses: number;
    net_profit: number | null;
    hourly_net_profit: number | null;
    is_low_margin: boolean;
    signing_hours: number;
  };
}

type AppMode = 'Review' | 'Auto';
type ErrorAction = 'analyze' | 'notify';

interface AppError {
  message: string;
  detail?: string;
  action?: ErrorAction;
}

// ─── Onboarding slides ────────────────────────────────────────────────
const ONBOARDING_SLIDES = [
  {
    icon: <FileText className="w-10 h-10 text-white" />,
    bg: 'bg-black',
    title: 'Paste any offer',
    body: 'Copy a signing offer from email, text, or any platform and paste it here. Works with any format.',
  },
  {
    icon: <Zap className="w-10 h-10 text-white fill-white" />,
    bg: 'bg-amber-500',
    title: 'Get an instant decision',
    body: 'AI reads the offer, calculates your real cost, and tells you to Accept, Counter, or Decline — in seconds.',
  },
  {
    icon: <Copy className="w-10 h-10 text-white" />,
    bg: 'bg-emerald-500',
    title: 'Copy and reply',
    body: 'Your response is written and ready. One tap to copy, then paste it back to the LSA. Done.',
  },
];

function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0);
  const s = ONBOARDING_SLIDES[slide];
  const isLast = slide === ONBOARDING_SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 p-8">
      <motion.div
        key={slide}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center text-center max-w-sm w-full"
      >
        <div className={`w-24 h-24 ${s.bg} rounded-3xl flex items-center justify-center mb-8 shadow-2xl`}>
          {s.icon}
        </div>
        <h2 className="text-2xl font-display font-black text-slate-900 mb-3 tracking-tight">{s.title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-10">{s.body}</p>
      </motion.div>

      {/* Dots */}
      <div className="flex gap-2 mb-8">
        {ONBOARDING_SLIDES.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-6 bg-black' : 'w-1.5 bg-slate-200'}`} />
        ))}
      </div>

      <button
        onClick={() => isLast ? onDone() : setSlide(s => s + 1)}
        className="w-full max-w-sm px-8 py-4 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98]"
      >
        {isLast ? 'Get Started' : 'Next'}
      </button>
      {!isLast && (
        <button onClick={onDone} className="mt-4 text-xs text-slate-400 font-bold uppercase tracking-widest">
          Skip
        </button>
      )}
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────
const AUDIT_FIELD_LABELS: Record<string, string> = {
  appointment_datetime: 'Appointment date & time',
  signing_address: 'Signing address',
  offered_fee: 'Offered fee',
  document_type: 'Document type',
  page_count: 'Page count',
  docs_source: 'Who prints docs',
  print_deadline: 'Print-ready deadline',
  scanbacks_required: 'Scanbacks required?',
  scanback_deadline: 'Scanback deadline',
  dropoff_required: 'Drop-off required?',
  dropoff_location: 'Drop-off location',
  dropoff_deadline: 'Drop-off cutoff',
  borrower_contact: 'Borrower contact',
  lsa_contact: 'LSA direct contact',
  special_instructions: 'Special instructions',
};
const CRITICAL_FIELDS = new Set(['appointment_datetime', 'signing_address', 'offered_fee', 'dropoff_required', 'docs_source']);

function gradeColor(g: string) {
  if (g === 'A') return { text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-400', bar: 'bg-emerald-500' };
  if (g === 'B') return { text: 'text-sky-600', bg: 'bg-sky-50', ring: 'ring-sky-400', bar: 'bg-sky-500' };
  if (g === 'C') return { text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-400', bar: 'bg-amber-500' };
  if (g === 'D') return { text: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-400', bar: 'bg-orange-500' };
  return { text: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-400', bar: 'bg-rose-500' };
}

function getDecisionStyles(decision: Decision) {
  switch (decision) {
    case 'ACCEPT': return { bg: 'bg-emerald-500', cardBg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle2 className="w-7 h-7 text-white" />, label: 'Accept' };
    case 'COUNTER': return { bg: 'bg-amber-500', cardBg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <ArrowRightLeft className="w-7 h-7 text-white" />, label: 'Counter' };
    case 'DECLINE': return { bg: 'bg-rose-500', cardBg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: <XCircle className="w-7 h-7 text-white" />, label: 'Decline' };
    case 'CONDITIONAL_COUNTER': return { bg: 'bg-orange-500', cardBg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: <GitMerge className="w-7 h-7 text-white" />, label: 'Conditional' };
    case 'RATE_QUOTE': return { bg: 'bg-sky-500', cardBg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', icon: <DollarSign className="w-7 h-7 text-white" />, label: 'Rate Quote' };
    default: return { bg: 'bg-indigo-500', cardBg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', icon: <AlertCircle className="w-7 h-7 text-white" />, label: 'Review' };
  }
}

// ─── Critical Alert Strip ─────────────────────────────────────────────
function CriticalAlerts({ audit }: { audit: OfferAudit }) {
  const alerts: { type: 'conflict' | 'missing' | 'flag'; text: string }[] = [];

  if (audit.schedule_conflict_warning?.startsWith('CONFLICT')) {
    alerts.push({ type: 'conflict', text: audit.schedule_conflict_warning });
  }
  if (audit.critical_missing.length > 0) {
    alerts.push({ type: 'missing', text: `Missing critical info: ${audit.critical_missing.map(f => AUDIT_FIELD_LABELS[f] || f).join(', ')}` });
  }
  // Top risk flag only (if not already captured above)
  if (audit.risk_flags.length > 0 && alerts.length < 2) {
    alerts.push({ type: 'flag', text: audit.risk_flags[0] });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-2xl text-xs font-medium leading-relaxed ${
          a.type === 'conflict' ? 'bg-rose-500 text-white' :
          a.type === 'missing' ? 'bg-rose-50 border border-rose-200 text-rose-700' :
          'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          {a.type === 'conflict' ? <Clock className="w-4 h-4 shrink-0 mt-0.5" /> :
           a.type === 'missing' ? <ShieldX className="w-4 h-4 shrink-0 mt-0.5" /> :
           <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{a.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Decision Hero ────────────────────────────────────────────────────
function DecisionHero({ job, copied, onCopyFee }: {
  job: AnalysisResult;
  copied: boolean;
  onCopyFee: () => void;
}) {
  const ds = getDecisionStyles(job.decision);
  const confidenceLabel = { HIGH: 'High confidence', MEDIUM: 'Medium confidence', LOW: 'Low confidence' }[job.confidence];

  return (
    <div className={`rounded-3xl overflow-hidden shadow-xl`}>
      {/* Decision bar */}
      <div className={`${ds.bg} px-6 py-5 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            {ds.icon}
          </div>
          <div>
            <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">AI Recommendation</p>
            <p className="text-white text-2xl font-display font-black tracking-tight">{ds.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-0.5">{confidenceLabel}</p>
          <div className="flex items-baseline gap-0.5">
            <span className="text-white/60 text-lg font-bold">$</span>
            <span className="text-white text-4xl font-display font-black">{job.recommended_fee}</span>
          </div>
          {job.fee_data_quality !== 'HIGH' && (
            <p className="text-white/50 text-[9px] mt-0.5">Estimated fee</p>
          )}
        </div>
      </div>

      {/* Response message — the most important thing after decision */}
      <div className="bg-white px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ready to Send</p>
          <button
            onClick={onCopyFee}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-black text-white hover:bg-slate-700'}`}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy Reply'}
          </button>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed font-mono">
          {job.response_message}
        </p>
      </div>
    </div>
  );
}

// ─── Collapsible Audit Panel ──────────────────────────────────────────
function CollapsibleAuditPanel({ audit, loading }: { audit: OfferAudit; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const grade = gradeColor(audit.completeness_grade);
  const fieldEntries = Object.entries(audit.fields);

  const statusIcon = (status: AuditStatus, isCritical: boolean) => {
    if (status === 'PRESENT') return <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    if (status === 'VAGUE') return <CircleHelp className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (isCritical) return <ShieldX className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    return <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
  };

  const badgeStyle = (s: AuditStatus) => {
    if (s === 'PRESENT') return 'bg-emerald-50 text-emerald-700';
    if (s === 'VAGUE') return 'bg-amber-50 text-amber-700';
    return 'bg-rose-50 text-rose-700';
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header — always visible, tap to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${grade.bg}`}>
            <ShieldAlert className={`w-4 h-4 ${grade.text}`} />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Offer Audit</p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              {loading ? 'Analyzing...' : `${audit.completeness_score}% complete · Grade ${audit.completeness_grade}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          {!loading && (
            <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${grade.bg} ${grade.text}`}>
              {audit.risk_flags.length > 0 ? `${audit.risk_flags.length} flag${audit.risk_flags.length > 1 ? 's' : ''}` : 'No flags'}
            </div>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {open && !loading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Score bar */}
            <div className="px-6 pb-4">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${audit.completeness_score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${grade.bar}`}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {fieldEntries.map(([field, status]) => {
                  const isCritical = CRITICAL_FIELDS.has(field);
                  return (
                    <div key={field} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${
                      status === 'PRESENT' ? 'bg-slate-50' :
                      status === 'VAGUE' ? 'bg-amber-50/40' :
                      isCritical ? 'bg-rose-50/60' : 'bg-slate-50/30'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {statusIcon(status, isCritical)}
                        <span className={`text-[11px] font-medium truncate ${
                          status === 'PRESENT' ? 'text-slate-600' :
                          status === 'VAGUE' ? 'text-amber-700' :
                          isCritical ? 'text-rose-700' : 'text-slate-400'
                        }`}>{AUDIT_FIELD_LABELS[field] || field}</span>
                      </div>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${badgeStyle(status)}`}>{status}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All risk flags */}
            {audit.risk_flags.length > 0 && (
              <div className="px-6 pb-4 space-y-1.5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <TriangleAlert className="w-3 h-3 text-amber-500" /> Risk Flags
                </p>
                {audit.risk_flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl">
                    <TriangleAlert className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-800 leading-relaxed">{flag}</p>
                  </div>
                ))}
              </div>
            )}

            {/* LSA note */}
            {audit.lsa_accountability_note && (
              <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                <LSANoteBlock note={audit.lsa_accountability_note} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LSA Note Block ───────────────────────────────────────────────────
function LSANoteBlock({ note }: { note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquareWarning className="w-3.5 h-3.5 text-slate-500" />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Clarification Request</p>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed italic">&ldquo;{note}&rdquo;</p>
      <button
        onClick={() => { navigator.clipboard.writeText(note); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-wider transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied!' : 'Copy Message'}
      </button>
    </div>
  );
}

// ─── Rate Inquiry Card ────────────────────────────────────────────────
function RateInquiryCard({ message, onCopy, copied }: { message: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-sky-500 px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
          <DollarSign className="w-7 h-7 text-white" />
        </div>
        <div>
          <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Rate Inquiry</p>
          <p className="text-white text-lg font-display font-black">Send your rate sheet</p>
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <p className="text-xs text-slate-500">This is a prospect asking about rates, not a confirmed job. Reply with your standard rates and ask for job details.</p>
        <div className="p-4 bg-sky-50 rounded-2xl">
          <p className="text-sm text-slate-700 leading-relaxed font-mono">{message}</p>
        </div>
        <button onClick={onCopy} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-black text-white hover:bg-slate-700'}`}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Rate Reply'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function PricingAssistant() {
  const [offerText, setOfferText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingPhase, setIsAnalyzingPhase] = useState<'idle' | 'fast' | 'full'>('idle');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<AppMode>('Review');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isNotifying, setIsNotifying] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [jobs, setJobs] = useState<AnalysisResult[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);

  const activeJob = jobs.find(j => j.id === activeJobId) || null;
  const [pendingSharedText, setPendingSharedText] = useState<string | null>(null);
  const pendingSettingsRef = React.useRef<PricingSettings>(DEFAULT_SETTINGS);

  React.useEffect(() => {
    const sj = localStorage.getItem('notary_job_history');
    if (sj) { try { setJobs(JSON.parse(sj)); } catch {} }

    let freshSettings = DEFAULT_SETTINGS;
    const ss = localStorage.getItem('notary_pricing_settings');
    if (ss) { try { freshSettings = JSON.parse(ss); setSettings(freshSettings); } catch {} }
    pendingSettingsRef.current = freshSettings;

    // Show onboarding first time only
    const seen = localStorage.getItem('sigseal_onboarding_done');
    if (!seen) setShowOnboarding(true);

    // Share target
    const sessionText = sessionStorage.getItem('sigseal_shared_text');
    const params = new URLSearchParams(window.location.search);
    const urlText = params.get('text') || params.get('title') || params.get('url');
    const rawText = sessionText || urlText;
    if (rawText) {
      sessionStorage.removeItem('sigseal_shared_text');
      window.history.replaceState({}, '', window.location.pathname);
      let decoded = rawText;
      try { decoded = decodeURIComponent(rawText); } catch {}
      setPendingSharedText(decoded);
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (mounted && pendingSharedText) {
      setPendingSharedText(null);
      handleAnalyzeText(pendingSharedText, pendingSettingsRef.current);
    }
  }, [mounted, pendingSharedText]);

  const completeOnboarding = () => {
    localStorage.setItem('sigseal_onboarding_done', '1');
    setShowOnboarding(false);
  };

  const saveSettings = (s: PricingSettings) => {
    setSettings(s);
    localStorage.setItem('notary_pricing_settings', JSON.stringify(s));
    setShowSettings(false);
  };

  const updateJobNotes = (id: string, notes: string) => {
    const updated = jobs.map(j => j.id === id ? { ...j, notes } : j);
    setJobs(updated);
    localStorage.setItem('notary_job_history', JSON.stringify(updated));
  };

  const handleAnalyzeText = async (text: string, settingsOverride?: PricingSettings) => {
    if (!text.trim()) return;
    const activeSettings = settingsOverride ?? settings;
    setIsAnalyzing(true);
    setIsAnalyzingPhase('fast');
    setError(null);
    setNotificationSent(false);

    try {
      const fast = await analyzeJobOfferFast(text, activeSettings);
      const jobId = Math.random().toString(36).substr(2, 9);

      const newJob: AnalysisResult = {
        ...fast,
        id: jobId,
        status: 'new',
        auditLoading: fast.message_type !== 'pre_offer_inquiry',
        timestamp: Date.now(),
        overhead: {
          base_overhead: 0, travel_cost: 0, printing_cost: 0, time_cost: 0, scanback_cost: 0,
          total_expenses: fast.total_expenses ?? 0,
          net_profit: fast.net_profit ?? null,
          hourly_net_profit: null,
          is_low_margin: fast.net_profit != null && fast.net_profit < 0,
          signing_hours: fast.signing_hours ?? 0,
        },
        parsed_input: {
          offered_fee: fast.offered_fee ?? null,
          distance_miles: fast.distance_miles ?? 10,
          time_type: fast.time_type ?? 'standard',
          document_type: fast.document_type ?? 'general',
          page_count: fast.page_count ?? 25,
          requires_scanbacks: null,
          is_short_notice: fast.is_short_notice ?? false,
          appointment_time: null, appointment_date: null, signing_address: null,
          dropoff_required: null, dropoff_same_day: null, lsa_name: null,
        },
        offer_audit: {
          fields: Object.fromEntries(
            ['appointment_datetime','signing_address','offered_fee','document_type','page_count',
             'docs_source','print_deadline','scanbacks_required','scanback_deadline','dropoff_required',
             'dropoff_location','dropoff_deadline','borrower_contact','lsa_contact','special_instructions']
            .map(k => [k, 'MISSING' as AuditStatus])
          ),
          completeness_score: 0, completeness_grade: 'F',
          critical_missing: [], risk_flags: [],
          schedule_conflict_warning: null, lsa_accountability_note: null,
        },
        conditions_required: [],
      };

      const newJobs = [newJob, ...jobs].slice(0, 20);
      setJobs(newJobs);
      setActiveJobId(jobId);
      localStorage.setItem('notary_job_history', JSON.stringify(newJobs));
      setOfferText('');
      setIsAnalyzingPhase('full');

      if (fast.message_type !== 'pre_offer_inquiry') {
        analyzeJobOfferFull(text, activeSettings)
          .then((full) => {
            setJobs(prev => {
              const updated = prev.map(j => j.id === jobId ? {
                ...j, auditLoading: false,
                parsed_input: { ...j.parsed_input, ...full.parsed_input },
                offer_audit: full.offer_audit,
                conditions_required: full.conditions_required ?? [],
              } : j);
              localStorage.setItem('notary_job_history', JSON.stringify(updated));
              return updated;
            });
          })
          .catch(() => {
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, auditLoading: false } : j));
          });
      }

      if (fast.decision === 'ACCEPT' && fast.confidence === 'HIGH' && mode === 'Auto') {
        handleNotify(newJob);
      }
    } catch (err: any) {
      setError({
        message: 'Failed to analyze this offer.',
        detail: err?.message || 'Unknown error from analysis service.',
        action: 'analyze',
      });
    } finally {
      setIsAnalyzing(false);
      setIsAnalyzingPhase('idle');
    }
  };

  const handleAnalyze = () => handleAnalyzeText(offerText);
  const retryLastAction = () => {
    if (!error?.action) return;
    setError(null);
    if (error.action === 'analyze') {
      handleAnalyze();
      return;
    }
    if (error.action === 'notify' && activeJob) {
      handleNotify(activeJob);
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
      const response = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) });
      if (response.ok) { setNotificationSent(true); updateJobStatus(job.id, 'completed'); }
      else {
        const body = await response.json().catch(() => ({}));
        setError({
          message: 'Could not log this decision.',
          detail: body?.error ? JSON.stringify(body.error) : `Request failed with status ${response.status}.`,
          action: 'notify',
        });
      }
    } catch (err: any) {
      setError({
        message: 'Could not log this decision.',
        detail: err?.message || 'Unknown network error.',
        action: 'notify',
      });
    }
    finally { setIsNotifying(false); }
  };

  const copyReply = (text: string) => {
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

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Onboarding */}
      <AnimatePresence>
        {showOnboarding && <OnboardingScreen onDone={completeOnboarding} />}
      </AnimatePresence>

      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-sm font-display font-black tracking-tight text-slate-900">Signature Seal AI</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={mode} onChange={(e) => setMode(e.target.value as AppMode)} className="bg-slate-100 border-none rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 outline-none cursor-pointer hover:bg-slate-200">
            <option value="Review">Review</option>
            <option value="Auto">Auto-Accept</option>
          </select>
          <button aria-label="Open onboarding help" title="Open onboarding help" onClick={() => setShowOnboarding(true)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all text-xs font-bold">?</button>
          <button aria-label="Open settings" title="Open settings" onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all">
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel — Inbox */}
        <aside className={`absolute inset-0 z-20 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 lg:w-72 xl:w-80 ${activeJobId ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}`}>
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jobs</span>
            <button aria-label="Clear all jobs" title="Clear all jobs" onClick={() => { setJobs([]); localStorage.removeItem('notary_job_history'); }} className="p-1 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Input */}
            <div className="relative">
              <textarea
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnalyze(); }}
                placeholder="Paste job offer or rate inquiry..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black/10 focus:bg-white focus:border-black outline-none transition-all resize-none h-24"
              />
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                {!offerText.trim() && (
                  <button aria-label="Paste from clipboard" onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setOfferText(t); } catch {} }}
                    className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all" title="Paste from clipboard">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                <button aria-label="Analyze offer" onClick={handleAnalyze} disabled={isAnalyzing || !offerText.trim()}
                  className="p-2 bg-black text-white rounded-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all">
                  {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isAnalyzingPhase === 'fast' && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                <span className="text-xs text-slate-500">Reading offer...</span>
              </div>
            )}

            {jobs.length === 0 && !isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Calculator className="w-8 h-8 text-slate-200 mb-3" />
                <p className="text-xs text-slate-400">Paste any offer to begin.</p>
              </div>
            )}

            {jobs.map((job) => {
              const ds = getDecisionStyles(job.decision);
              const isActive = activeJobId === job.id;
              return (
                <motion.button layout key={job.id}
                  onClick={() => { setActiveJobId(job.id); setEditedNotes(job.notes || ''); setIsEditingNotes(false); if (job.status === 'new') updateJobStatus(job.id, 'reviewed'); }}
                  className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all relative overflow-hidden ${isActive ? 'bg-black border-black' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                  whileTap={{ scale: 0.98 }}
                >
                  {isActive && <motion.div layoutId="activeBar" className="absolute left-0 top-0 bottom-0 w-1 bg-white z-10" />}

                  <div className="flex items-center justify-between mb-2 pl-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${job.status === 'new' ? 'bg-rose-500 animate-pulse' : job.status === 'reviewed' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-white/50' : 'text-slate-400'}`}>
                        {job.decision === 'RATE_QUOTE' ? 'Rate Inquiry' : job.parsed_input.document_type}
                      </span>
                      {job.is_urgent && <span className="text-[8px] font-black px-1 py-0.5 bg-amber-100 text-amber-700 rounded uppercase">Urgent</span>}
                    </div>
                    <span className={`text-sm font-display font-black ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {job.parsed_input.offered_fee != null ? `$${job.parsed_input.offered_fee}` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pl-1">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase ${isActive ? 'bg-white/20 text-white' : `${ds.cardBg.split(' ')[0]} ${ds.text}`}`}>
                      {job.decision === 'ACCEPT' && <CheckCircle2 className="w-3 h-3" />}
                      {job.decision === 'COUNTER' && <ArrowRightLeft className="w-3 h-3" />}
                      {job.decision === 'DECLINE' && <XCircle className="w-3 h-3" />}
                      {job.decision === 'REVIEW' && <AlertCircle className="w-3 h-3" />}
                      {job.decision === 'CONDITIONAL_COUNTER' && <GitMerge className="w-3 h-3" />}
                      {job.decision === 'RATE_QUOTE' && <DollarSign className="w-3 h-3" />}
                      {ds.label}
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                  </div>

                  {/* Quick warnings on card */}
                  {!isActive && (job.offer_audit?.critical_missing?.length > 0 || job.offer_audit?.schedule_conflict_warning?.startsWith('CONFLICT')) && (
                    <div className="mt-2 pl-1 flex items-center gap-1.5">
                      <ShieldX className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="text-[9px] font-bold text-rose-500">
                        {job.offer_audit?.schedule_conflict_warning?.startsWith('CONFLICT') ? 'Schedule conflict' : `${job.offer_audit.critical_missing.length} critical field${job.offer_audit.critical_missing.length > 1 ? 's' : ''} missing`}
                      </span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </aside>

        {/* Right Panel — Detail */}
        <main className={`flex-1 flex flex-col bg-slate-50 overflow-y-auto transition-transform duration-300 ${activeJobId ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          {activeJob ? (
            <div className="max-w-2xl mx-auto w-full p-4 md:p-6 space-y-4">
              {/* Mobile back */}
              <button onClick={() => setActiveJobId(null)} className="lg:hidden flex items-center gap-2 text-slate-400 text-xs font-bold uppercase">
                <X className="w-4 h-4" /> Back
              </button>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-700">
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error.message}
                  </div>
                  {error.detail && (
                    <p className="text-[11px] text-rose-700/80 leading-relaxed pl-7">{error.detail}</p>
                  )}
                  {error.action && (
                    <div className="pl-7">
                      <button
                        onClick={retryLastAction}
                        className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── SECTION 1: DECISION + RESPONSE MESSAGE — always first ── */}
              {activeJob.decision === 'RATE_QUOTE' ? (
                <RateInquiryCard
                  message={activeJob.rate_inquiry_response || activeJob.response_message}
                  onCopy={() => copyReply(activeJob.rate_inquiry_response || activeJob.response_message)}
                  copied={copied}
                />
              ) : (
                <>
                  {/* Urgent strip */}
                  {activeJob.is_urgent && activeJob.primary_action && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-amber-500 rounded-2xl">
                      <Zap className="w-4 h-4 text-white fill-white shrink-0 mt-0.5" />
                      <p className="text-sm font-bold text-white">{activeJob.primary_action}</p>
                    </div>
                  )}

                  {/* Decision hero with response message embedded */}
                  <DecisionHero
                    job={activeJob}
                    copied={copied}
                    onCopyFee={() => copyReply(activeJob.response_message)}
                  />

                  {/* ── SECTION 2: CRITICAL ALERTS — only what matters ── */}
                  {!activeJob.auditLoading && activeJob.offer_audit && (
                    <CriticalAlerts audit={activeJob.offer_audit} />
                  )}

                  {/* ── SECTION 3: ACTION BUTTONS — above the fold ── */}
                  {activeJob.decision !== 'REVIEW' && (
                    <div className="grid grid-cols-3 gap-3">
                      {(['ACCEPT', 'COUNTER', 'DECLINE'] as const).map((action) => {
                        const ds = getDecisionStyles(action);
                        const isRec = (activeJob.decision === action || (action === 'COUNTER' && activeJob.decision === 'CONDITIONAL_COUNTER'));
                        return (
                          <button key={action}
                            onClick={() => handleNotify({ ...activeJob, decision: action })}
                            disabled={isNotifying || activeJob.status === 'completed'}
                            className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 active:scale-[0.97] ${
                              isRec
                                ? `${action === 'ACCEPT' ? 'bg-emerald-500' : action === 'COUNTER' ? 'bg-amber-500' : 'bg-rose-500'} text-white shadow-lg`
                                : 'bg-white border-2 border-slate-100 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {action === 'ACCEPT' && <CheckCircle2 className="w-5 h-5" />}
                            {action === 'COUNTER' && <ArrowRightLeft className="w-5 h-5" />}
                            {action === 'DECLINE' && <XCircle className="w-5 h-5" />}
                            {action === 'ACCEPT' ? 'Accept' : action === 'COUNTER' ? 'Counter' : 'Decline'}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeJob.decision === 'REVIEW' && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-1">More info needed</p>
                        <p className="text-xs text-indigo-600 leading-relaxed">Ask the LSA for the missing details below before deciding.</p>
                      </div>
                    </div>
                  )}

                  {notificationSent && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-2 text-sm font-bold">
                      <Check className="w-4 h-4" /> Logged
                    </motion.div>
                  )}

                  {/* ── SECTION 4: OFFER AUDIT — collapsed by default ── */}
                  <CollapsibleAuditPanel
                    audit={activeJob.offer_audit}
                    loading={activeJob.auditLoading}
                  />

                  {/* Conditions for conditional counter */}
                  {activeJob.decision === 'CONDITIONAL_COUNTER' && activeJob.conditions_required?.length > 0 && (
                    <div className="bg-orange-50 rounded-3xl border border-orange-200 p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <GitMerge className="w-4 h-4 text-orange-500" />
                        <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Resolve Before Confirming</p>
                      </div>
                      {activeJob.conditions_required.map((c, i) => (
                        <div key={i} className="flex gap-2.5 p-3 bg-white rounded-xl border border-orange-100">
                          <span className="text-[10px] font-black text-orange-400 shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-xs text-slate-700 leading-relaxed">{c}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Private Notes — bottom, unobtrusive */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Private Notes</p>
                      <div className="flex items-center gap-2">
                        <button aria-label="Delete this job from history" title="Delete this job" onClick={() => removeFromHistory(activeJob.id)} className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isEditingNotes ? (
                          <button aria-label="Save private notes" title="Save notes" onClick={() => { updateJobNotes(activeJob.id, editedNotes); setIsEditingNotes(false); }} className="p-1.5 bg-black text-white rounded-lg">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button aria-label="Edit private notes" title="Edit notes" onClick={() => setIsEditingNotes(true)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {isEditingNotes ? (
                      <textarea value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} placeholder="Add private notes..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none h-24 resize-none" />
                    ) : (
                      <p className="text-xs text-slate-400 italic cursor-pointer" onClick={() => setIsEditingNotes(true)}>
                        {activeJob.notes || 'Tap to add notes...'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center mb-4">
                <Calculator className="w-7 h-7 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Ready when you are</h3>
              <p className="text-sm text-slate-400 max-w-xs">Paste a job offer in the panel to get an instant decision.</p>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-slate-900">Settings</h2>
                <button aria-label="Close settings" title="Close settings" onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-5 space-y-8 overflow-y-auto">
                {/* Home ZIP — affects distance on every job */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Your Location</h3></div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Home ZIP Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="e.g. 43214"
                      value={settings.homeZip || ''}
                      onChange={(e) => setSettings({...settings, homeZip: e.target.value.replace(/\D/g,'')})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-black outline-none text-sm font-bold"
                    />
                    <p className="text-[10px] text-slate-400 leading-relaxed">Used to estimate driving distance from your home to each signing. More accurate fee calculations.</p>
                  </div>
                </div>

                {/* Auto-Accept mode explanation */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Mode</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${mode === 'Review' ? 'border-black bg-black text-white' : 'border-slate-100 bg-slate-50 text-slate-600'}`} onClick={() => setMode('Review')}>
                      <p className="text-xs font-black mb-1">Review</p>
                      <p className={`text-[10px] leading-relaxed ${mode === 'Review' ? 'text-white/70' : 'text-slate-400'}`}>You confirm every action manually. Recommended for most users.</p>
                    </div>
                    <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${mode === 'Auto' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-600'}`} onClick={() => setMode('Auto')}>
                      <p className="text-xs font-black mb-1">Auto-Accept</p>
                      <p className={`text-[10px] leading-relaxed ${mode === 'Auto' ? 'text-emerald-600' : 'text-slate-400'}`}>Automatically logs ACCEPT when AI is HIGH confidence. You still manually Counter or Decline.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Fee Structure</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{label:'Base Fee ($)',key:'baseFee',step:'1'},{label:'Mileage ($/mi)',key:'mileageRate',step:'0.01'},{label:'After Hours',key:'afterHoursFee',step:'1'},{label:'Refinance +',key:'refinanceFee',step:'1'},{label:'Purchase +',key:'purchaseFee',step:'1'}].map(({label,key,step}) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</label>
                        <input type="number" step={step} value={(settings as any)[key]} onChange={(e) => setSettings({...settings,[key]:Number(e.target.value)})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-black outline-none text-sm font-bold" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2"><Calculator className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Overhead</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{label:'IRS Mileage ($)',key:'irsMileageRate',step:'0.01'},{label:'Printing ($/pg)',key:'printingRate',step:'0.01'},{label:'Hourly Rate ($)',key:'hourlyRate',step:'1'},{label:'Scanback Fee ($)',key:'scanbackFee',step:'1'},{label:'Min Hourly Profit',key:'minHourlyNetProfit',step:'1'},{label:'Base Overhead',key:'baseOverhead',step:'1'}].map(({label,key,step}) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</label>
                        <input type="number" step={step} value={(settings as any)[key]} onChange={(e) => setSettings({...settings,[key]:Number(e.target.value)})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-black outline-none text-sm font-bold" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Templates</h3></div>
                  {[{label:'Accept',key:'ACCEPT',rows:2},{label:'Counter',key:'COUNTER',rows:3},{label:'Decline',key:'DECLINE',rows:2},{label:'Conditional Counter',key:'CONDITIONAL_COUNTER',rows:3},{label:'Rate Inquiry',key:'RATE_INQUIRY',rows:3}].map(({label,key,rows}) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</label>
                      <textarea value={(settings.templates as any)[key]||''} onChange={(e) => setSettings({...settings,templates:{...settings.templates,[key]:e.target.value}})} rows={rows} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-black outline-none text-sm font-mono" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 shrink-0">
                <button onClick={() => saveSettings(settings)} className="w-full py-4 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
