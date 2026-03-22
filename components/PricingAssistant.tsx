'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calculator, AlertCircle, CheckCircle2, XCircle, ArrowRightLeft,
  Copy, Check, Loader2, Settings as SettingsIcon, MapPin, Clock,
  DollarSign, FileText, Trash2, ChevronRight, Sparkles, Zap, X, Save,
  ShieldAlert, ShieldX, TriangleAlert, BadgeCheck, CircleHelp,
  MessageSquareWarning, Zap as UrgentIcon, GitMerge, Send,
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

type AppMode = 'Guide' | 'Agent (Draft)' | 'Agent (Auto)';

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

// ─── Helpers ─────────────────────────────────────────────────────────
function gradeColor(g: string) {
  if (g === 'A') return { text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-400', bar: 'bg-emerald-500' };
  if (g === 'B') return { text: 'text-sky-600', bg: 'bg-sky-50', ring: 'ring-sky-400', bar: 'bg-sky-500' };
  if (g === 'C') return { text: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-400', bar: 'bg-amber-500' };
  if (g === 'D') return { text: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-400', bar: 'bg-orange-500' };
  return { text: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-400', bar: 'bg-rose-500' };
}

function getDecisionStyles(decision: Decision) {
  switch (decision) {
    case 'ACCEPT': return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />, accent: 'bg-emerald-500', label: 'ACCEPT' };
    case 'COUNTER': return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <ArrowRightLeft className="w-6 h-6 text-amber-500" />, accent: 'bg-amber-500', label: 'COUNTER' };
    case 'DECLINE': return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: <XCircle className="w-6 h-6 text-rose-500" />, accent: 'bg-rose-500', label: 'DECLINE' };
    case 'CONDITIONAL_COUNTER': return { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: <GitMerge className="w-6 h-6 text-orange-500" />, accent: 'bg-orange-500', label: 'CONDITIONAL' };
    case 'RATE_QUOTE': return { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', icon: <DollarSign className="w-6 h-6 text-sky-500" />, accent: 'bg-sky-500', label: 'RATE QUOTE' };
    default: return { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', icon: <AlertCircle className="w-6 h-6 text-indigo-500" />, accent: 'bg-indigo-500', label: 'REVIEW' };
  }
}

// ─── Urgent Banner ────────────────────────────────────────────────────
function UrgentBanner({ primaryAction }: { primaryAction: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20"
    >
      <UrgentIcon className="w-5 h-5 text-white mt-0.5 shrink-0 fill-white" />
      <div>
        <p className="text-[10px] font-black text-amber-100 uppercase tracking-widest mb-0.5">Urgent — Act Now</p>
        <p className="text-sm font-bold text-white leading-snug">{primaryAction}</p>
      </div>
    </motion.div>
  );
}

// ─── Rate Inquiry Card ────────────────────────────────────────────────
function RateInquiryCard({ message, onCopy, copied }: { message: string; onCopy: () => void; copied: boolean }) {
  return (
    <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-50 rounded-xl">
          <DollarSign className="w-5 h-5 text-sky-500" />
        </div>
        <div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rate Inquiry Detected</h3>
          <p className="text-xs text-slate-500 mt-0.5">This is a prospect, not a job offer. Send your rate sheet and request details.</p>
        </div>
      </div>
      <div className="p-5 bg-sky-50 border border-sky-100 rounded-2xl">
        <p className="text-sm text-slate-700 leading-relaxed font-mono">{message}</p>
      </div>
      <button
        onClick={onCopy}
        className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy Rate Reply'}
      </button>
    </section>
  );
}

// ─── Conditions Card ─────────────────────────────────────────────────
function ConditionsCard({ conditions, lsaNote }: { conditions: string[]; lsaNote: string | null }) {
  const [copied, setCopied] = useState(false);
  const textToCopy = lsaNote || conditions.join('\n');
  return (
    <section className="bg-orange-50 rounded-[2rem] p-8 border border-orange-200 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-xl shadow-sm">
          <GitMerge className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h3 className="text-[10px] font-black text-orange-700 uppercase tracking-[0.2em]">Conditions Required Before Confirming</h3>
          <p className="text-xs text-orange-600 mt-0.5">Do not confirm this job until the LSA resolves these items.</p>
        </div>
      </div>
      <div className="space-y-2">
        {conditions.map((c, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-orange-100">
            <span className="text-[10px] font-black text-orange-500 mt-0.5 shrink-0">{i + 1}</span>
            <p className="text-sm text-slate-700 leading-relaxed">{c}</p>
          </div>
        ))}
      </div>
      {lsaNote && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Send to LSA</p>
          <div className="p-4 bg-white rounded-xl border border-orange-100">
            <p className="text-sm text-slate-600 leading-relaxed italic">&ldquo;{lsaNote}&rdquo;</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(textToCopy); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy Message'}
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Audit Skeleton ───────────────────────────────────────────────────
function AuditSkeleton() {
  return (
    <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 pt-8 pb-6 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-1 text-right">
              <div className="h-2 w-8 bg-slate-100 rounded animate-pulse ml-auto" />
              <div className="h-5 w-12 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="w-14 h-14 rounded-full bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="mt-5 h-1.5 bg-slate-100 rounded-full animate-pulse" />
      </div>
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="h-3 bg-slate-100 rounded animate-pulse" style={{ width: `${55 + (i % 3) * 15}%` }} />
              <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Running full audit...</span>
        </div>
      </div>
    </section>
  );
}

// ─── Offer Audit Panel ────────────────────────────────────────────────
function OfferAuditPanel({ audit }: { audit: OfferAudit }) {
  const [expanded, setExpanded] = useState(false);
  const grade = gradeColor(audit.completeness_grade);
  const fieldEntries = Object.entries(audit.fields);
  const visible = expanded ? fieldEntries : fieldEntries.slice(0, 8);

  const statusIcon = (status: AuditStatus, isCritical: boolean) => {
    if (status === 'PRESENT') return <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    if (status === 'VAGUE') return <CircleHelp className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (isCritical) return <ShieldX className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    return <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
  };

  const statusBadgeStyle = (s: AuditStatus) => {
    if (s === 'PRESENT') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (s === 'VAGUE') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-rose-50 text-rose-700 border-rose-100';
  };

  return (
    <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 pt-8 pb-6 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${grade.bg}`}>
              <ShieldAlert className={`w-5 h-5 ${grade.text}`} />
            </div>
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Offer Audit</h3>
              <p className="text-xs font-bold text-slate-600 mt-0.5">LSA Completeness Check</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Score</p>
              <p className="text-xl font-display font-black text-slate-900">{audit.completeness_score}%</p>
            </div>
            <div className={`w-14 h-14 rounded-full ring-4 ${grade.ring} ring-offset-2 ${grade.bg} flex items-center justify-center`}>
              <span className={`text-2xl font-display font-black ${grade.text}`}>{audit.completeness_grade}</span>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${audit.completeness_score}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className={`h-full rounded-full ${grade.bar}`} />
          </div>
        </div>
      </div>

      {audit.critical_missing.length > 0 && (
        <div className="mx-8 mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
          <ShieldX className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">Critical Info Missing</p>
            <p className="text-xs text-rose-600 leading-relaxed">{audit.critical_missing.map(f => AUDIT_FIELD_LABELS[f] || f).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visible.map(([field, status]) => {
            const isCritical = CRITICAL_FIELDS.has(field);
            return (
              <div key={field} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${status === 'PRESENT' ? 'bg-slate-50/50 border-slate-100' : status === 'VAGUE' ? 'bg-amber-50/40 border-amber-100' : isCritical ? 'bg-rose-50/60 border-rose-100' : 'bg-slate-50/30 border-slate-100'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {statusIcon(status, isCritical)}
                  <span className={`text-[11px] font-bold truncate ${status === 'PRESENT' ? 'text-slate-600' : status === 'VAGUE' ? 'text-amber-700' : isCritical ? 'text-rose-700' : 'text-slate-400'}`}>
                    {AUDIT_FIELD_LABELS[field] || field}
                    {isCritical && status !== 'PRESENT' && <span className="ml-1 text-[9px] font-black text-rose-400 uppercase">critical</span>}
                  </span>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider shrink-0 ${statusBadgeStyle(status)}`}>{status}</span>
              </div>
            );
          })}
        </div>
        {fieldEntries.length > 8 && (
          <button onClick={() => setExpanded(!expanded)} className="mt-3 w-full text-center text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors py-2">
            {expanded ? '↑ Show Less' : `↓ Show ${fieldEntries.length - 8} More Fields`}
          </button>
        )}
      </div>

      {audit.risk_flags.length > 0 && (
        <div className="px-8 pb-6 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-500" /> Risk Flags
          </p>
          {audit.risk_flags.map((flag, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border ${i === 0 && audit.risk_flags.length > 1 ? 'bg-amber-50 border-amber-200' : 'bg-amber-50/50 border-amber-100'}`}>
              <TriangleAlert className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">{flag}</p>
            </div>
          ))}
        </div>
      )}

      {audit.schedule_conflict_warning && (
        <div className="px-8 pb-6">
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl">
            <Clock className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">Schedule Conflict Detected</p>
              <p className="text-xs text-rose-600 leading-relaxed">{audit.schedule_conflict_warning}</p>
            </div>
          </div>
        </div>
      )}

      {audit.lsa_accountability_note && (
        <div className="px-8 pb-8">
          <LSANoteBlock note={audit.lsa_accountability_note} />
        </div>
      )}
    </section>
  );
}

// ─── LSA Note Block (reusable copy component) ─────────────────────────
function LSANoteBlock({ note }: { note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquareWarning className="w-3.5 h-3.5 text-slate-500" />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Suggested Clarification Request</p>
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

// ─── Main Component ───────────────────────────────────────────────────
export default function PricingAssistant() {
  const [offerText, setOfferText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingPhase, setIsAnalyzingPhase] = useState<'idle' | 'fast' | 'full'>('idle');
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
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);

  const activeJob = jobs.find(j => j.id === activeJobId) || null;

  React.useEffect(() => {
    const sj = localStorage.getItem('notary_job_history');
    if (sj) { try { setJobs(JSON.parse(sj)); } catch {} }
    const ss = localStorage.getItem('notary_pricing_settings');
    if (ss) { try { setSettings(JSON.parse(ss)); } catch {} }
    // PWA share target — grab shared text and auto-analyze
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get('text') || params.get('title') || params.get('url');
    if (sharedText) {
      const decoded = decodeURIComponent(sharedText);
      window.history.replaceState({}, '', window.location.pathname);
      setMounted(true);
      // Auto-analyze after mount — slight delay so state is ready
      setTimeout(() => handleAnalyzeText(decoded), 100);
    } else {
      setMounted(true);
    }
  }, []);

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

  const handleAnalyzeText = async (text: string) => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setIsAnalyzingPhase('fast');
    setError(null);
    setNotificationSent(false);

    try {
      // ── Phase 1: Fast triage — decision + fee in ~1s ──
      const fast = await analyzeJobOfferFast(text, settings);
      const jobId = Math.random().toString(36).substr(2, 9);

      const newJob: AnalysisResult = {
        ...fast,
        id: jobId,
        status: 'new',
        auditLoading: fast.message_type !== 'pre_offer_inquiry',
        timestamp: Date.now(),
        // Phase 2 fields default until audit arrives
        parsed_input: {
          offered_fee: fast.offered_fee ?? null,
          distance_miles: fast.distance_miles ?? 10,
          time_type: fast.time_type ?? 'standard',
          document_type: fast.document_type ?? 'general',
          page_count: fast.page_count ?? 25,
          requires_scanbacks: null,
          is_short_notice: fast.is_short_notice ?? false,
          appointment_time: null,
          appointment_date: null,
          signing_address: null,
          dropoff_required: null,
          dropoff_same_day: null,
          lsa_name: null,
        },
        offer_audit: {
          fields: Object.fromEntries(
            ['appointment_datetime','signing_address','offered_fee','document_type','page_count',
             'docs_source','print_deadline','scanbacks_required','scanback_deadline','dropoff_required',
             'dropoff_location','dropoff_deadline','borrower_contact','lsa_contact','special_instructions']
            .map(k => [k, 'MISSING'])
          ) as any,
          completeness_score: 0,
          completeness_grade: 'F',
          critical_missing: [],
          risk_flags: [],
          schedule_conflict_warning: null,
          lsa_accountability_note: null,
        },
        conditions_required: [],
      };

      const newJobs = [newJob, ...jobs].slice(0, 20);
      setJobs(newJobs);
      setActiveJobId(jobId);
      setEditedMessage(fast.response_message || '');
      localStorage.setItem('notary_job_history', JSON.stringify(newJobs));
      setOfferText('');
      setIsAnalyzingPhase('full');

      // ── Phase 2: Full audit — runs while user reads Phase 1 result ──
      if (fast.message_type !== 'pre_offer_inquiry') {
        analyzeJobOfferFull(text, settings)
          .then((full) => {
            setJobs(prev => {
              const updated = prev.map(j => j.id === jobId ? {
                ...j,
                auditLoading: false,
                parsed_input: { ...j.parsed_input, ...full.parsed_input },
                offer_audit: full.offer_audit,
                conditions_required: full.conditions_required ?? [],
              } : j);
              localStorage.setItem('notary_job_history', JSON.stringify(updated));
              return updated;
            });
          })
          .catch(() => {
            // Audit failed — just hide the skeleton, keep Phase 1 result
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, auditLoading: false } : j));
          });
      }

      if (fast.decision === 'ACCEPT' && fast.confidence === 'HIGH' && mode === 'Agent (Auto)') {
        handleNotify(newJob);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to analyze. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setIsAnalyzingPhase('idle');
    }
  };

  const handleAnalyze = () => handleAnalyzeText(offerText);

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
      else setError('Failed to send notification.');
    } catch { setError('An error occurred while sending the notification.'); }
    finally { setIsNotifying(false); }
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

  const isRateInquiry = activeJob?.decision === 'RATE_QUOTE';
  const isConditional = activeJob?.decision === 'CONDITIONAL_COUNTER';
  const isUrgent = activeJob?.is_urgent;

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-black/20">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-display font-black tracking-tight text-slate-900 leading-none">SIGNATURE SEAL AI</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operations Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live Sync</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={mode} onChange={(e) => setMode(e.target.value as AppMode)} className="bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-black/5 cursor-pointer outline-none transition-all hover:bg-slate-200">
              <option value="Guide">Guide Mode</option>
              <option value="Agent (Draft)">Agent Mode (Draft)</option>
              <option value="Agent (Auto)">Agent Mode (Auto)</option>
            </select>
            <button onClick={() => setShowSettings(true)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200">
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel */}
        <aside className={`absolute inset-0 z-20 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 lg:w-80 xl:w-96 ${activeJobId ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Incoming Jobs</h2>
            <button onClick={() => { setJobs([]); localStorage.removeItem('notary_job_history'); }} className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="relative group">
              <textarea
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAnalyze(); }}
                placeholder="Paste job offer or rate inquiry..."
                className="w-full p-4 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-black/5 focus:bg-white focus:border-black outline-none transition-all resize-none h-28 shadow-inner"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                {!offerText.trim() && (
                  <button
                    onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setOfferText(t); } catch {} }}
                    className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-all"
                    title="Paste from clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <button onClick={handleAnalyze} disabled={isAnalyzing || !offerText.trim()} className="p-2.5 bg-black text-white rounded-xl disabled:opacity-50 shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all">
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {jobs.length === 0 && !isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <Calculator className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-400">Paste any offer or rate inquiry to begin.</p>
              </div>
            )}

            {isAnalyzingPhase === 'fast' && (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Reading offer...</span>
              </div>
            )}

            {jobs.map((job) => {
              const ds = getDecisionStyles(job.decision);
              const isActive = activeJobId === job.id;
              const auditScore = job.offer_audit?.completeness_score;
              const gc = job.offer_audit ? gradeColor(job.offer_audit.completeness_grade) : null;
              return (
                <motion.button layout key={job.id} onClick={() => { setActiveJobId(job.id); setEditedMessage(job.response_message); setEditedNotes(job.notes || ''); setIsEditingNotes(false); if (job.status === 'new') updateJobStatus(job.id, 'reviewed'); }}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all group relative overflow-hidden ${isActive ? 'bg-black border-black shadow-xl shadow-black/20' : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                  whileHover={{ scale: isActive ? 1 : 1.01 }} whileTap={{ scale: 0.98 }}
                >
                  {isActive && <><motion.div layoutId="activeIndicator" className="absolute left-0 top-0 bottom-0 w-1 bg-white z-20" transition={{ type: 'spring', stiffness: 300, damping: 30 }} /><div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8" /></>}

                  <div className="flex items-start justify-between mb-2 relative z-10 pl-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${job.status === 'new' ? 'bg-rose-500 animate-pulse' : job.status === 'reviewed' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                      {job.is_urgent && !isActive && <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase tracking-wider">Urgent</span>}
                      {job.decision === 'RATE_QUOTE' && !isActive && <span className="text-[8px] font-black px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded uppercase tracking-wider">Rate Inquiry</span>}
                      {job.decision !== 'RATE_QUOTE' && <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white/60' : 'text-slate-400'}`}>{job.parsed_input.document_type}</span>}
                      {!isActive && gc && auditScore !== undefined && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${gc.bg} ${gc.text}`}>{auditScore}%</span>
                      )}
                    </div>
                    <span className={`text-base font-display font-black ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {job.parsed_input.offered_fee != null ? `$${job.parsed_input.offered_fee}` : '—'}
                    </span>
                  </div>

                  {job.decision !== 'RATE_QUOTE' && (
                    <div className={`flex items-center gap-3 text-[11px] font-bold relative z-10 pl-1 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.parsed_input.distance_miles} mi</div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.parsed_input.time_type.replace('_', ' ')}</div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between relative z-10">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${isActive ? 'bg-white/20 text-white' : ds.bg + ' ' + ds.text}`}>{ds.label}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] font-bold ${isActive ? 'text-white/40' : 'text-slate-400'}`}>{new Date(job.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <ChevronRight className={`w-3 h-3 transition-transform ${isActive ? 'text-white translate-x-1' : 'text-slate-300'}`} />
                    </div>
                  </div>

                  {!isActive && job.offer_audit?.critical_missing?.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 pl-1 relative z-10">
                      <ShieldX className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="text-[9px] font-bold text-rose-500 truncate">{job.offer_audit.critical_missing.length} critical field{job.offer_audit.critical_missing.length > 1 ? 's' : ''} missing</span>
                    </div>
                  )}
                  {!isActive && job.offer_audit?.schedule_conflict_warning?.startsWith('CONFLICT') && (
                    <div className="mt-1 flex items-center gap-1.5 pl-1 relative z-10">
                      <Clock className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="text-[9px] font-bold text-rose-500">Schedule conflict detected</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </aside>

        {/* Right Panel */}
        <main className={`flex-1 flex flex-col bg-slate-50 overflow-y-auto transition-transform duration-300 ${activeJobId ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          {activeJob ? (
            <div className="max-w-3xl mx-auto w-full p-4 md:p-8 space-y-6">
              <button onClick={() => setActiveJobId(null)} className="lg:hidden flex items-center gap-2 text-slate-400 font-bold text-xs uppercase mb-2">
                <X className="w-4 h-4" /> Back to Inbox
              </button>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              {/* Urgent banner — top priority */}
              {isUrgent && activeJob.primary_action && <UrgentBanner primaryAction={activeJob.primary_action} />}

              {/* Rate inquiry — simplified view */}
              {isRateInquiry ? (
                <>
                  <RateInquiryCard
                    message={activeJob.rate_inquiry_response || activeJob.response_message}
                    onCopy={() => copyToClipboard(activeJob.rate_inquiry_response || activeJob.response_message)}
                    copied={copied}
                  />
                  <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Private Notes</h3>
                    {isEditingNotes ? (
                      <div className="space-y-3">
                        <textarea value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm outline-none h-24" />
                        <button onClick={() => { updateJobNotes(activeJob.id, editedNotes); setIsEditingNotes(false); }} className="p-2 bg-black text-white rounded-xl"><Save className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-2xl min-h-[60px] cursor-pointer" onClick={() => setIsEditingNotes(true)}>
                        <p className="text-sm text-slate-400 italic">{activeJob.notes || 'Add notes about this prospect...'}</p>
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <>
                  {/* Non-urgent primary action */}
                  {!isUrgent && activeJob.primary_action && (
                    <div className="flex items-start gap-3 p-4 bg-slate-100 rounded-2xl">
                      <Sparkles className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      <p className="text-sm font-medium text-slate-700">{activeJob.primary_action}</p>
                    </div>
                  )}

                  {/* Job Summary Grid */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Job Analysis</h3>
                      <button onClick={() => removeFromHistory(activeJob.id)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { icon: <FileText className="w-4 h-4 text-indigo-500" />, bg: 'bg-indigo-50', label: 'Document', value: activeJob.parsed_input.document_type },
                        { icon: <DollarSign className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-50', label: 'Offered', value: activeJob.parsed_input.offered_fee != null ? `$${activeJob.parsed_input.offered_fee}` : '—' },
                        { icon: <MapPin className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-50', label: 'Distance', value: `${activeJob.parsed_input.distance_miles} mi` },
                        { icon: <Clock className="w-4 h-4 text-rose-500" />, bg: 'bg-rose-50', label: 'Time', value: activeJob.parsed_input.time_type.replace('_', ' ') },
                      ].map(({ icon, bg, label, value }) => (
                        <div key={label} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                          <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
                          <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{label}</p><p className="text-sm font-display font-black text-slate-900 capitalize">{value}</p></div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Offer Audit — skeleton during Phase 2, panel when ready */}
                  {activeJob.auditLoading
                    ? <AuditSkeleton />
                    : activeJob.offer_audit && <OfferAuditPanel audit={activeJob.offer_audit} />
                  }

                  {/* Conditions — shown before recommendation for CONDITIONAL_COUNTER */}
                  {isConditional && activeJob.conditions_required?.length > 0 && (
                    <ConditionsCard conditions={activeJob.conditions_required} lsaNote={activeJob.offer_audit?.lsa_accountability_note || null} />
                  )}

                  {/* Overhead HUD */}
                  {activeJob.overhead && (
                    <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Overhead HUD</h3>
                          <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${(activeJob.overhead.net_profit ?? 0) < 0 ? 'bg-rose-50 text-rose-600' : (activeJob.overhead.hourly_net_profit ?? 0) < 20 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {(activeJob.overhead.net_profit ?? 0) < 0 ? '🔴 LOSS' : (activeJob.overhead.hourly_net_profit ?? 0) < 20 ? '🟡 THIN' : '🟢 PROFITABLE'}
                          </div>
                          {activeJob.overhead.is_low_margin && (
                            <div className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Low Margin
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Expenses</span>
                          <span className="text-xl font-display font-black text-slate-900">${activeJob.overhead.total_expenses.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[
                          { label: 'Base', value: activeJob.overhead.base_overhead },
                          { label: 'Travel', value: activeJob.overhead.travel_cost },
                          { label: 'Printing', value: activeJob.overhead.printing_cost },
                          { label: 'Time', value: activeJob.overhead.time_cost },
                          { label: 'Scanbacks', value: activeJob.overhead.scanback_cost },
                          { label: 'Hrs Est.', value: activeJob.overhead.signing_hours, suffix: 'hr' },
                        ].map(({ label, value, suffix }) => (
                          <div key={label} className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{label}</span>
                            <span className="text-sm font-bold text-slate-700">{suffix ? `${value?.toFixed(1)}${suffix}` : `$${(value ?? 0).toFixed(2)}`}</span>
                          </div>
                        ))}
                      </div>
                      {activeJob.professional_justification && (
                        <div className="pt-6 border-t border-slate-100">
                          <div className="flex items-center gap-2 mb-3"><Sparkles className="w-3 h-3 text-amber-500" /><span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">AI Justification</span></div>
                          <p className="text-xs text-slate-500 leading-relaxed italic">&ldquo;{activeJob.professional_justification}&rdquo;</p>
                        </div>
                      )}
                    </section>
                  )}

                  {/* AI Recommendation */}
                  {!isConditional && (
                    <section className={`rounded-[2.5rem] p-10 border-2 shadow-2xl relative overflow-hidden ${getDecisionStyles(activeJob.decision).bg}`}>
                      <div className={`absolute top-0 right-0 w-64 h-64 -mr-16 -mt-16 rounded-full opacity-10 blur-3xl ${getDecisionStyles(activeJob.decision).accent}`} />
                      <div className="relative z-10 space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-sm">{getDecisionStyles(activeJob.decision).icon}</div>
                            <div>
                              <span className={`text-4xl font-display font-black tracking-tighter uppercase ${getDecisionStyles(activeJob.decision).text}`}>{getDecisionStyles(activeJob.decision).label}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Sparkles className={`w-3 h-3 ${getDecisionStyles(activeJob.decision).text} opacity-50`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${getDecisionStyles(activeJob.decision).text} opacity-60`}>AI Recommendation</span>
                              </div>
                            </div>
                          </div>
                          <div className="px-4 py-2 bg-white/40 backdrop-blur-md rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] text-slate-600 border border-white/30 shadow-sm">{activeJob.confidence} Confidence</div>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${getDecisionStyles(activeJob.decision).text} opacity-50`}>Suggested Fee</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-display font-black text-slate-400">$</span>
                                <p className="text-8xl font-display font-black text-slate-900 tracking-tighter leading-none">{activeJob.recommended_fee}</p>
                              </div>
                              {activeJob.fee_data_quality !== 'HIGH' && activeJob.fee_data_quality_note && (
                                <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-[11px] font-medium leading-snug ${activeJob.fee_data_quality === 'LOW' ? 'bg-amber-100 text-amber-800' : 'bg-white/60 text-slate-600'}`}>
                                  <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span>Estimate: {activeJob.fee_data_quality_note}</span>
                                </div>
                              )}
                            </div>
                            <button onClick={() => copyToClipboard(`Fair Fee: $${activeJob.recommended_fee}\nReason: ${activeJob.professional_justification || activeJob.reasoning}`)} className="flex items-center gap-2 px-4 py-2 bg-white/50 hover:bg-white/80 backdrop-blur-sm rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 transition-all border border-white/30">
                              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              {copied ? 'Copied' : 'Copy Fee & Reason'}
                            </button>
                          </div>
                          <div className="max-w-xs bg-white/30 backdrop-blur-sm p-5 rounded-2xl border border-white/20">
                            <p className="text-xs leading-relaxed text-slate-700 font-bold italic">&ldquo;{activeJob.reasoning}&rdquo;</p>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Response Message */}
                  <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Response Message</h3>
                        {mode !== 'Guide' && <span className="px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase tracking-widest rounded-full">Draft</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditingMessage(!isEditingMessage)} className={`p-2 rounded-xl transition-all ${isEditingMessage ? 'bg-black text-white' : 'hover:bg-slate-50 text-slate-400'}`}><FileText className="w-4 h-4" /></button>
                        <button onClick={() => copyToClipboard(editedMessage)} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400">
                          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {isEditingMessage ? (
                      <textarea value={editedMessage} onChange={(e) => setEditedMessage(e.target.value)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-mono leading-relaxed focus:ring-4 focus:ring-black/5 focus:border-black outline-none h-40 transition-all" />
                    ) : (
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-sm text-slate-700 leading-relaxed font-mono break-words">{editedMessage}</p>
                      </div>
                    )}
                  </section>

                  {/* Private Notes */}
                  <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Private Notes</h3>
                      {isEditingNotes ? (
                        <button onClick={() => { updateJobNotes(activeJob.id, editedNotes); setIsEditingNotes(false); }} className="p-2 bg-black text-white rounded-xl"><Save className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => setIsEditingNotes(true)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><FileText className="w-4 h-4" /></button>
                      )}
                    </div>
                    {isEditingNotes ? (
                      <textarea value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} placeholder="Add private notes..." className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm outline-none h-32" />
                    ) : (
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 min-h-[80px]">
                        <p className="text-sm text-slate-400 italic">{activeJob.notes || 'No private notes yet.'}</p>
                      </div>
                    )}
                  </section>

                  {/* Action Buttons */}
                  {activeJob.decision !== 'REVIEW' && (
                    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(['COUNTER', 'ACCEPT', 'DECLINE'] as const).map((action) => {
                        const ds = getDecisionStyles(action);
                        const isRec = (activeJob.decision === action || (action === 'COUNTER' && activeJob.decision === 'CONDITIONAL_COUNTER')) && mode !== 'Guide';
                        return (
                          <button key={action} onClick={() => handleNotify({ ...activeJob, response_message: editedMessage, decision: action })} disabled={isNotifying || activeJob.status === 'completed'}
                            className={`flex items-center justify-center gap-3 px-6 py-5 rounded-[1.5rem] font-display font-black uppercase tracking-wider text-xs transition-all shadow-xl disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] ${isRec ? `${action === 'ACCEPT' ? 'bg-emerald-500 shadow-emerald-500/30' : action === 'COUNTER' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-rose-500 shadow-rose-500/30'} text-white` : 'bg-white border-2 border-slate-100 text-slate-900 hover:border-slate-300'}`}
                          >
                            {action === 'ACCEPT' && <CheckCircle2 className="w-4 h-4" />}
                            {action === 'COUNTER' && <ArrowRightLeft className="w-4 h-4" />}
                            {action === 'DECLINE' && <XCircle className="w-4 h-4" />}
                            {isRec ? `Confirm ${action.charAt(0) + action.slice(1).toLowerCase()}` : action === 'COUNTER' ? 'Send Counter' : action === 'ACCEPT' ? 'Accept As-Is' : 'Decline'}
                          </button>
                        );
                      })}
                    </section>
                  )}

                  {activeJob.decision === 'REVIEW' && (
                    <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-1">Awaiting More Information</p>
                        <p className="text-xs text-indigo-600 leading-relaxed">Request the missing details from the LSA before taking action. Use the clarification message in the Offer Audit section above.</p>
                      </div>
                    </div>
                  )}

                  {notificationSent && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-emerald-500/20">
                      <Check className="w-5 h-5" /> Action Logged Successfully
                    </motion.div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-white rounded-full shadow-xl shadow-slate-200/50 flex items-center justify-center mb-4"><Calculator className="w-8 h-8 text-slate-200" /></div>
              <h3 className="text-xl font-bold text-slate-900">Select a job to review</h3>
              <p className="text-sm text-slate-400 max-w-xs">Paste any job offer or rate inquiry from the left panel to get started.</p>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-900">Pricing Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="p-5 md:p-8 space-y-8 overflow-y-auto">
                {/* Fee Structure */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Fee Structure</h3></div>
                  <div className="grid grid-cols-2 gap-4">
                    {[{ label: 'Base Fee ($)', key: 'baseFee', step: '1' }, { label: 'Mileage ($/mi)', key: 'mileageRate', step: '0.01' }].map(({ label, key, step }) => (
                      <div key={key} className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</label>
                        <input type="number" step={step} value={(settings as any)[key]} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none text-base font-bold" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ label: 'After Hours', key: 'afterHoursFee' }, { label: 'Refinance', key: 'refinanceFee' }, { label: 'Purchase', key: 'purchaseFee' }].map(({ label, key }) => (
                      <div key={key} className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{label}</label>
                        <input type="number" value={(settings as any)[key]} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none text-sm font-bold" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Overhead */}
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2"><Calculator className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Overhead Config</h3></div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'IRS Mileage ($)', key: 'irsMileageRate', step: '0.01' }, { label: 'Printing ($/pg)', key: 'printingRate', step: '0.01' },
                      { label: 'Hourly Rate ($)', key: 'hourlyRate', step: '1' }, { label: 'Scanback Fee ($)', key: 'scanbackFee', step: '1' },
                      { label: 'Min Hourly Profit ($)', key: 'minHourlyNetProfit', step: '1' }, { label: 'Base Overhead ($)', key: 'baseOverhead', step: '1' },
                    ].map(({ label, key, step }) => (
                      <div key={key} className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</label>
                        <input type="number" step={step} value={(settings as any)[key]} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none text-sm font-bold" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Templates */}
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Message Templates</h3></div>
                  {[
                    { label: 'Accept', key: 'ACCEPT', rows: 2 }, { label: 'Counter', key: 'COUNTER', rows: 3 },
                    { label: 'Decline', key: 'DECLINE', rows: 2 }, { label: 'Conditional Counter', key: 'CONDITIONAL_COUNTER', rows: 3 },
                    { label: 'Rate Inquiry Reply', key: 'RATE_INQUIRY', rows: 3 },
                  ].map(({ label, key, rows }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{label}</label>
                      <textarea value={(settings.templates as any)[key] || ''} onChange={(e) => setSettings({ ...settings, templates: { ...settings.templates, [key]: e.target.value } })} rows={rows} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-black/5 focus:border-black outline-none text-sm font-mono" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 md:p-8 bg-white border-t border-slate-100 shrink-0">
                <button onClick={() => saveSettings(settings)} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-black text-white rounded-2xl font-display font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all shadow-xl shadow-black/20 active:scale-[0.98]">
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
