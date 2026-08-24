/**
 * Dynamic AI Lead Scoring Engine
 * 
 * Rules:
 * - Phone Number Present: +20
 * - WhatsApp Number Present: +10
 * - Email Present: +15
 * - Product/Service Interest Present: +15
 * - Message Length > 20 Characters: +20
 * - Buying Intent Keywords Present: +20
 * 
 * Buying Intent Keywords:
 * buy, purchase, price, quotation, quote, interested, order, available, stock, delivery, today, urgent
 * 
 * Score Ranges:
 * 0 - 39: Cold Lead
 * 40 - 69: Warm Lead
 * 70 - 100: Hot Lead
 */

export interface LeadScoringInput {
  phone?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  email?: string;
  productInterest?: string;
  serviceInterest?: string;
  message?: string;
  customerMessage?: string;
  notes?: string;
}

export type LeadTemperature = 'Cold Lead' | 'Warm Lead' | 'Hot Lead';

export interface LeadScoreBreakdown {
  hasPhone: boolean;
  phonePoints: number;
  hasWhatsapp: boolean;
  whatsappPoints: number;
  hasEmail: boolean;
  emailPoints: number;
  hasProductInterest: boolean;
  productInterestPoints: number;
  isMessageLong: boolean;
  messageLength: number;
  messageLengthPoints: number;
  hasBuyingIntent: boolean;
  matchedKeywords: string[];
  buyingIntentPoints: number;
  totalScore: number;
  leadScore: number; // alias for totalScore
  temperature: LeadTemperature;
  leadTemperature: LeadTemperature; // alias for temperature
  priority: 'High' | 'Normal' | 'Low';
  rationale: string;
}

export const BUYING_INTENT_KEYWORDS = [
  'buy',
  'purchase',
  'price',
  'quotation',
  'quote',
  'interested',
  'order',
  'available',
  'stock',
  'delivery',
  'today',
  'urgent'
];

/**
 * Calculates lead score dynamically based on user-provided rules.
 */
export function calculateDynamicLeadScore(input: LeadScoringInput): LeadScoreBreakdown {
  const phoneVal = (input.phone || input.phoneNumber || '').trim();
  const whatsappVal = (input.whatsappNumber || '').trim();
  const emailVal = (input.email || '').trim();
  const productVal = (input.productInterest || input.serviceInterest || '').trim();
  const messageVal = (input.message || input.customerMessage || input.notes || '').trim();

  // 1. Phone Number Present (+20)
  const cleanPhoneDigits = phoneVal.replace(/\D/g, '');
  const hasPhone = cleanPhoneDigits.length >= 5 || phoneVal.length >= 5;
  const phonePoints = hasPhone ? 20 : 0;

  // 2. WhatsApp Number Present (+10)
  const cleanWhatsappDigits = whatsappVal.replace(/\D/g, '');
  const hasWhatsapp = cleanWhatsappDigits.length >= 5 || whatsappVal.length >= 5;
  const whatsappPoints = hasWhatsapp ? 10 : 0;

  // 3. Email Present (+15)
  const hasEmail = emailVal.length > 0 && emailVal.includes('@');
  const emailPoints = hasEmail ? 15 : 0;

  // 4. Product/Service Interest Present (+15)
  const hasProductInterest = productVal.length > 0;
  const productInterestPoints = hasProductInterest ? 15 : 0;

  // 5. Message Length > 20 Characters (+20)
  const messageLength = messageVal.length;
  const isMessageLong = messageLength > 20;
  const messageLengthPoints = isMessageLong ? 20 : 0;

  // 6. Buying Intent Keywords (+20)
  const textToScan = `${messageVal} ${productVal}`.toLowerCase();
  const matchedKeywords: string[] = [];

  for (const keyword of BUYING_INTENT_KEYWORDS) {
    // Check if the keyword appears in the message or product interest text
    const regex = new RegExp(`\\b${keyword}`, 'i');
    if (regex.test(textToScan) || textToScan.includes(keyword)) {
      if (!matchedKeywords.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }
  }

  const hasBuyingIntent = matchedKeywords.length > 0;
  const buyingIntentPoints = hasBuyingIntent ? 20 : 0;

  // Compute Total Score
  const rawScore = phonePoints + whatsappPoints + emailPoints + productInterestPoints + messageLengthPoints + buyingIntentPoints;
  const totalScore = Math.min(100, Math.max(0, rawScore));

  // Determine Temperature & Priority
  let temperature: LeadTemperature = 'Cold Lead';
  let priority: 'High' | 'Normal' | 'Low' = 'Low';

  if (totalScore >= 70) {
    temperature = 'Hot Lead';
    priority = 'High';
  } else if (totalScore >= 40) {
    temperature = 'Warm Lead';
    priority = 'Normal';
  } else {
    temperature = 'Cold Lead';
    priority = 'Low';
  }

  // Construct readable rationale
  const reasons: string[] = [];
  if (hasPhone) reasons.push('Phone provided (+20)');
  if (hasWhatsapp) reasons.push('WhatsApp provided (+10)');
  if (hasEmail) reasons.push('Email provided (+15)');
  if (hasProductInterest) reasons.push(`Product specified "${productVal}" (+15)`);
  if (isMessageLong) reasons.push(`Detailed inquiry >20 chars (+20)`);
  if (hasBuyingIntent) reasons.push(`Intent keywords: [${matchedKeywords.join(', ')}] (+20)`);

  const rationale = reasons.length > 0 
    ? `${temperature} (${totalScore}/100): ${reasons.join(', ')}`
    : `Cold Lead (${totalScore}/100): Minimal contact and message details provided`;

  return {
    hasPhone,
    phonePoints,
    hasWhatsapp,
    whatsappPoints,
    hasEmail,
    emailPoints,
    hasProductInterest,
    productInterestPoints,
    isMessageLong,
    messageLength,
    messageLengthPoints,
    hasBuyingIntent,
    matchedKeywords,
    buyingIntentPoints,
    totalScore,
    leadScore: totalScore,
    temperature,
    leadTemperature: temperature,
    priority,
    rationale
  };
}

/**
 * Returns temperature category based on score
 */
export function getLeadTemperatureFromScore(score: number): LeadTemperature {
  const s = Number(score) || 0;
  if (s >= 70) return 'Hot Lead';
  if (s >= 40) return 'Warm Lead';
  return 'Cold Lead';
}

/**
 * Returns temperature badge styling classes
 */
export function getLeadTemperatureStyle(tempOrScore: LeadTemperature | number): {
  bg: string;
  text: string;
  border: string;
  badge: string;
  dot: string;
  label: LeadTemperature;
} {
  const temperature: LeadTemperature = typeof tempOrScore === 'number' 
    ? getLeadTemperatureFromScore(tempOrScore)
    : (tempOrScore as LeadTemperature);

  if (temperature === 'Hot Lead' || String(tempOrScore).toLowerCase().includes('hot')) {
    return {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      dot: 'bg-rose-500',
      label: 'Hot Lead'
    };
  }

  if (temperature === 'Warm Lead' || String(tempOrScore).toLowerCase().includes('warm')) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
      label: 'Warm Lead'
    };
  }

  return {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Cold Lead'
  };
}
