// lib/ai.ts

export interface PricingSettings {
  baseFee: number;
  mileageRate: number;
  afterHoursFee: number;
  refinanceFee: number;
  purchaseFee: number;

  irsMileageRate: number;
  printingRate: number;
  hourlyRate: number;
  scanbackFee: number;
  minHourlyNetProfit: number;
  baseOverhead: number;

  templates: {
    ACCEPT: string;
    COUNTER: string;
    DECLINE: string;
    CONDITIONAL_COUNTER: string;
    RATE_INQUIRY: string;
  };
}

export const DEFAULT_SETTINGS: PricingSettings = {
  baseFee: 75,
  mileageRate: 1.75,
  afterHoursFee: 25,
  refinanceFee: 25,
  purchaseFee: 35,

  irsMileageRate: 0.67,
  printingRate: 0.10,
  hourlyRate: 50,
  scanbackFee: 10,
  minHourlyNetProfit: 30,
  baseOverhead: 15,

  templates: {
    ACCEPT: "I'm available and would be happy to help with this signing. Please send over the documents.",
    COUNTER: "Thank you for the opportunity. Based on the distance and document requirements, my standard professional fee for this assignment is $[FEE]. Please let me know if that works for you.",
    DECLINE: "Thank you for reaching out. Unfortunately, I'm unavailable for this specific time/location. I hope to work with you in the future!",
    CONDITIONAL_COUNTER: "I'm interested in this signing and available at that time. Before I can confirm, I need to resolve a few items: [CONDITIONS]. Once those are addressed, my fee would be $[FEE].",
    RATE_INQUIRY: "Hi! Thanks for reaching out. My standard rates: Refinance from $[REFI_FEE], Purchase from $[PURCHASE_FEE], General/Loan Mod from $[BASE_FEE]. Final fee depends on distance, page count, scanback requirements, and same-day drop-off. Send me the job details and I'll give you a firm number right away.",
  },
};

// ─── PHASE 1: Fast triage — classify, fee, decision, primary action ───
// Target: under 1.5 seconds. Tiny output, minimal instructions.
export function getFastTriageInstruction(settings: PricingSettings = DEFAULT_SETTINGS) {
  return `
You are a mobile notary assistant. Analyze the message and return ONLY this JSON — nothing else.

CLASSIFICATION:
- "pre_offer_inquiry" if the message is only asking about availability or rates (no specific job)
- "job_offer" if it contains any specific job details

FEE MATH (only if job_offer):
  base = ${settings.baseFee}
  + ${settings.mileageRate} x distance_miles (estimate 10mi if unknown)
  + ${settings.afterHoursFee} if before 8am or after 7pm
  + ${settings.refinanceFee} if refinance
  + ${settings.purchaseFee} if purchase
  page_count: use stated value or estimate (refinance=150, purchase=200, general=25)
  signing_hours = (page_count / 80) + 0.5
  expenses = ${settings.baseOverhead} + (${settings.irsMileageRate} x miles) + (${settings.printingRate} x pages x 2 if notary prints) + (${settings.hourlyRate} x signing_hours) + (${settings.scanbackFee} if scanbacks)
  fair_fee = expenses + (${settings.minHourlyNetProfit} x signing_hours), round to nearest $5
  if urgent/short-notice: fair_fee x 1.25

DECISION:
  - RATE_QUOTE if pre_offer_inquiry
  - REVIEW if offered_fee missing AND it's a job_offer
  - ACCEPT if offered_fee >= fair_fee
  - COUNTER if offered_fee < fair_fee
  - DECLINE if net_profit < 0
  - CONDITIONAL_COUNTER if schedule conflict detected (signing + 75min > drop-off deadline)

Return ONLY this JSON:

RESPONSE MESSAGE TEMPLATES (use these to generate response_message):
- ACCEPT: "${settings.templates.ACCEPT}"
- COUNTER: Use "${settings.templates.COUNTER}" and replace [FEE] with recommended_fee
- DECLINE: "${settings.templates.DECLINE}"
- CONDITIONAL_COUNTER: Use "${settings.templates.CONDITIONAL_COUNTER}" and replace [CONDITIONS] and [FEE]
- RATE_QUOTE: "Hi! Thanks for reaching out. My standard rates: Refinance from $${settings.baseFee + settings.refinanceFee}, Purchase from $${settings.baseFee + settings.purchaseFee}, General/Loan Mod from $${settings.baseFee}. Send me the job details and I will give you a firm number right away."

JSON OUTPUT (return only this, no other text):
{
  "message_type": "job_offer | pre_offer_inquiry",
  "is_urgent": false,
  "decision": "ACCEPT | COUNTER | DECLINE | REVIEW | CONDITIONAL_COUNTER | RATE_QUOTE",
  "confidence": "LOW | MEDIUM | HIGH",
  "recommended_fee": 0,
  "offered_fee": null,
  "document_type": "refinance | purchase | general",
  "distance_miles": 10,
  "page_count": 25,
  "is_short_notice": false,
  "time_type": "standard | after_hours",
  "primary_action": "one sentence — the single most important thing to do right now",
  "response_message": "string — professional ready-to-send reply based on decision and templates above",
  "rate_inquiry_response": null,
  "fee_data_quality": "HIGH | MEDIUM | LOW",
  "fee_data_quality_note": null,
  "estimated_fields": [],
  "overhead": {
    "base_overhead": 0,
    "travel_cost": 0,
    "printing_cost": 0,
    "time_cost": 0,
    "scanback_cost": 0,
    "total_expenses": 0,
    "net_profit": null,
    "hourly_net_profit": null,
    "is_low_margin": false,
    "signing_hours": 0
  }
}
`;
}

// ─── PHASE 2: Full audit — 15-field checklist, risk flags, LSA note ──
// Runs after Phase 1 resolves. Notary sees triage result first.
export function getFullAuditInstruction(settings: PricingSettings = DEFAULT_SETTINGS) {
  return `
You are a mobile notary assistant. The notary already has the decision and fee from a fast analysis.
Your job is ONLY the detailed offer audit — extract all fields and identify every risk.

=== EXTRACTION ===
Extract:
- signing_address (string or null)
- signing_address_completeness: "full" | "partial" | "missing"
- appointment_time: 12-hour format like "2:00 PM" or null
- appointment_date: "YYYY-MM-DD" or null
- borrower_name (string or null)
- borrower_phone (string or null)
- docs_provided_by: "lsa" | "notary_prints" | null
- print_deadline_time (string or null)
- requires_scanbacks: true | false | null
- scanback_type: "fax" | "email" | "physical" | null
- scanback_deadline_time: specific time only, null if just "same day"
- dropoff_required: true | false | null
- dropoff_location (string or null)
- dropoff_deadline_time: 12-hour format or null
- dropoff_same_day: true | false | null
- lsa_name (string or null)
- lsa_contact_phone (string or null)
- lsa_contact_email (string or null)
- special_instructions (string or null)
- conditions_required: [] unless CONDITIONAL_COUNTER — list specific conditions LSA must resolve

=== OFFER AUDIT ===
Rate each field: "PRESENT" | "MISSING" | "VAGUE"

1. appointment_datetime — date AND time both given?
2. signing_address — full street + city?
3. offered_fee — explicitly stated?
4. document_type — signing type clear?
5. page_count — stated or strongly implied?
6. docs_source — who provides/prints docs?
7. print_deadline — specific time docs will be ready?
8. scanbacks_required — explicitly yes or no?
9. scanback_deadline — specific time (not just "same day")?
10. dropoff_required — same-day vs next-day explicitly stated?
11. dropoff_location — specific address?
12. dropoff_deadline — specific cutoff time?
13. borrower_contact — name and/or phone?
14. lsa_contact — direct contact name/phone/email?
15. special_instructions — wet ink, journal, ID requirements?

completeness_score = (PRESENT count / 15) * 100, round
completeness_grade: A=90-100, B=75-89, C=60-74, D=40-59, F=0-39
critical_missing: from [appointment_datetime, signing_address, offered_fee, dropoff_required, docs_source] where MISSING

risk_flags: specific strings — name the field and the consequence. Most time-sensitive first.

schedule_conflict_warning:
  If appointment_time AND dropoff_deadline_time known:
    duration = General:45min, Refinance:75min, Purchase:90min
    buffer = 20min scanbacks (if required) + 15min travel
    done_time = appointment_time + duration + buffer (express as 12-hour time e.g. "6:15 PM")
    If done_time > dropoff_deadline_time: "CONFLICT: Signing at [time] + [N]min = done by [done_time]. Drop-off closes at [deadline]. Same-day drop-off is impossible — renegotiate before accepting."
    If buffer < 30min: "TIGHT: Only [N]min buffer before drop-off closes at [deadline]. Any delay makes same-day impossible."
    Else: null
  Else: null

lsa_accountability_note: professional message to request missing info. null if completeness >= 87 and no conflict.

=== OUTPUT — valid JSON only ===
{
  "parsed_input": {
    "signing_address": null,
    "signing_address_completeness": "missing",
    "appointment_time": null,
    "appointment_date": null,
    "borrower_name": null,
    "borrower_phone": null,
    "docs_provided_by": null,
    "print_deadline_time": null,
    "requires_scanbacks": null,
    "scanback_type": null,
    "scanback_deadline_time": null,
    "dropoff_required": null,
    "dropoff_location": null,
    "dropoff_deadline_time": null,
    "dropoff_same_day": null,
    "lsa_name": null,
    "lsa_contact_phone": null,
    "lsa_contact_email": null,
    "special_instructions": null
  },
  "conditions_required": [],
  "offer_audit": {
    "fields": {
      "appointment_datetime": "MISSING",
      "signing_address": "MISSING",
      "offered_fee": "MISSING",
      "document_type": "MISSING",
      "page_count": "MISSING",
      "docs_source": "MISSING",
      "print_deadline": "MISSING",
      "scanbacks_required": "MISSING",
      "scanback_deadline": "MISSING",
      "dropoff_required": "MISSING",
      "dropoff_location": "MISSING",
      "dropoff_deadline": "MISSING",
      "borrower_contact": "MISSING",
      "lsa_contact": "MISSING",
      "special_instructions": "MISSING"
    },
    "completeness_score": 0,
    "completeness_grade": "F",
    "critical_missing": [],
    "risk_flags": [],
    "schedule_conflict_warning": null,
    "lsa_accountability_note": null
  }
}
`;
}

// ─── Client calls ─────────────────────────────────────────────────────

export async function analyzeJobOfferFast(offerText: string, settings: PricingSettings = DEFAULT_SETTINGS) {
  const response = await fetch('/api/analyze-fast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offerText, settings }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Server error: ${response.status}`);
  }
  return response.json();
}

export async function analyzeJobOfferFull(offerText: string, settings: PricingSettings = DEFAULT_SETTINGS) {
  const response = await fetch('/api/analyze-full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offerText, settings }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Server error: ${response.status}`);
  }
  return response.json();
}
