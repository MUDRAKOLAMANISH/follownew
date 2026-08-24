import { useState, useMemo } from 'react';
import { 
  Flame, 
  Zap, 
  Snowflake, 
  Sparkles, 
  Phone, 
  Mail, 
  MessageSquare, 
  Package, 
  FileText, 
  Tag,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  calculateDynamicLeadScore, 
  LeadScoringInput, 
  LeadScoreBreakdown, 
  getLeadTemperatureStyle 
} from '../lib/leadScoring';

export interface LeadScoreCardProps {
  input?: LeadScoringInput;
  existingBreakdown?: LeadScoreBreakdown;
  compact?: boolean;
  showRulesBreakdown?: boolean;
  showBreakdown?: boolean;
  defaultExpanded?: boolean;
}

export default function LeadScoreCard({
  input,
  existingBreakdown,
  compact = false,
  showRulesBreakdown,
  showBreakdown,
  defaultExpanded = false
}: LeadScoreCardProps) {
  // Allow explicit override if caller strictly specifies showBreakdown/showRulesBreakdown, else accordion state
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  const breakdown = useMemo(() => {
    if (existingBreakdown) return existingBreakdown;
    if (input) return calculateDynamicLeadScore(input);
    return calculateDynamicLeadScore({});
  }, [input, existingBreakdown]);

  const tempStyle = getLeadTemperatureStyle(breakdown.temperature);

  const getTempIcon = () => {
    if (breakdown.temperature === 'Hot Lead') {
      return <Flame className="h-4 w-4 text-rose-600 animate-pulse" />;
    }
    if (breakdown.temperature === 'Warm Lead') {
      return <Zap className="h-4 w-4 text-amber-600" />;
    }
    return <Snowflake className="h-4 w-4 text-slate-500" />;
  };

  const getProgressBarColor = () => {
    if (breakdown.totalScore >= 70) return 'bg-gradient-to-r from-rose-500 to-red-600';
    if (breakdown.totalScore >= 40) return 'bg-gradient-to-r from-amber-500 to-orange-500';
    return 'bg-gradient-to-r from-slate-400 to-slate-500';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
          <div 
            className={`h-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${breakdown.totalScore}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-900">{breakdown.totalScore}</span>
        <span className={`inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-md font-bold border ${tempStyle.badge}`}>
          {getTempIcon()}
          <span>{breakdown.temperature}</span>
        </span>
      </div>
    );
  }

  // Count active signals
  const activeSignalsCount = [
    breakdown.hasPhone,
    breakdown.hasWhatsapp,
    breakdown.hasEmail,
    breakdown.hasProductInterest,
    breakdown.isMessageLong,
    breakdown.hasBuyingIntent
  ].filter(Boolean).length;

  return (
    <div className={`rounded-xl border p-3.5 transition-all duration-200 ${tempStyle.bg} ${tempStyle.border} shadow-2xs`}>
      {/* Compact Header: Temperature Badge, Score, Progress & Accordion Trigger */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white shadow-2xs border border-gray-100 shrink-0">
            {getTempIcon()}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md border ${tempStyle.badge}`}>
                {breakdown.temperature}
              </span>
              <span className="text-2xs font-semibold text-gray-600 hidden sm:inline-block">
                Priority: {breakdown.priority}
              </span>
            </div>
            <p className="text-2xs text-gray-500 mt-0.5">
              Dynamic AI Intent Score
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-lg font-black text-gray-900">{breakdown.totalScore}</span>
            <span className="text-2xs font-bold text-gray-500">/ 100</span>
          </div>
          <span className="text-2xs font-bold text-indigo-700">
            {activeSignalsCount}/6 signals active
          </span>
        </div>
      </div>

      {/* Animated Score Progress Bar & Accordion Bar */}
      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/90 rounded-full overflow-hidden p-0.2 border border-black/5">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(100, Math.max(5, breakdown.totalScore))}%` }}
          />
        </div>

        {/* View Details Accordion Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white/80 hover:bg-white px-2.5 py-1 rounded-lg border border-indigo-200/80 transition flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
        >
          <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
          )}
        </button>
      </div>

      {/* Rules Breakdown Checklist (Collapsed by default, expands on View Details) */}
      {isExpanded && (
        <div className="space-y-2 pt-3 mt-3 border-t border-black/5">
          <div className="text-2xs font-bold text-gray-600 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-600" />
              Dynamic Scoring Contributors
            </span>
            <span className="text-indigo-700 font-semibold">{breakdown.totalScore} pts earned</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {/* Phone */}
            <div className={`flex items-center justify-between p-2 rounded-lg border text-2xs transition-colors ${
              breakdown.hasPhone ? 'bg-white border-emerald-200 text-emerald-900 font-medium' : 'bg-white/40 border-gray-200/60 text-gray-400'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <Phone className={`h-3 w-3 ${breakdown.hasPhone ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>Phone Number</span>
              </div>
              <span className={`font-bold shrink-0 ${breakdown.hasPhone ? 'text-emerald-700' : 'text-gray-400'}`}>
                {breakdown.hasPhone ? '+20 pts' : '+0'}
              </span>
            </div>

            {/* WhatsApp */}
            <div className={`flex items-center justify-between p-2 rounded-lg border text-2xs transition-colors ${
              breakdown.hasWhatsapp ? 'bg-white border-emerald-200 text-emerald-900 font-medium' : 'bg-white/40 border-gray-200/60 text-gray-400'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <MessageSquare className={`h-3 w-3 ${breakdown.hasWhatsapp ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>WhatsApp Number</span>
              </div>
              <span className={`font-bold shrink-0 ${breakdown.hasWhatsapp ? 'text-emerald-700' : 'text-gray-400'}`}>
                {breakdown.hasWhatsapp ? '+10 pts' : '+0'}
              </span>
            </div>

            {/* Email */}
            <div className={`flex items-center justify-between p-2 rounded-lg border text-2xs transition-colors ${
              breakdown.hasEmail ? 'bg-white border-emerald-200 text-emerald-900 font-medium' : 'bg-white/40 border-gray-200/60 text-gray-400'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <Mail className={`h-3 w-3 ${breakdown.hasEmail ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>Email Address</span>
              </div>
              <span className={`font-bold shrink-0 ${breakdown.hasEmail ? 'text-emerald-700' : 'text-gray-400'}`}>
                {breakdown.hasEmail ? '+15 pts' : '+0'}
              </span>
            </div>

            {/* Product Interest */}
            <div className={`flex items-center justify-between p-2 rounded-lg border text-2xs transition-colors ${
              breakdown.hasProductInterest ? 'bg-white border-emerald-200 text-emerald-900 font-medium' : 'bg-white/40 border-gray-200/60 text-gray-400'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <Package className={`h-3 w-3 ${breakdown.hasProductInterest ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>Product/Service Interest</span>
              </div>
              <span className={`font-bold shrink-0 ${breakdown.hasProductInterest ? 'text-emerald-700' : 'text-gray-400'}`}>
                {breakdown.hasProductInterest ? '+15 pts' : '+0'}
              </span>
            </div>

            {/* Message Length > 20 */}
            <div className={`flex items-center justify-between p-2 rounded-lg border text-2xs transition-colors ${
              breakdown.isMessageLong ? 'bg-white border-emerald-200 text-emerald-900 font-medium' : 'bg-white/40 border-gray-200/60 text-gray-400'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <FileText className={`h-3 w-3 ${breakdown.isMessageLong ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>Message &gt; 20 Chars ({breakdown.messageLength})</span>
              </div>
              <span className={`font-bold shrink-0 ${breakdown.isMessageLong ? 'text-emerald-700' : 'text-gray-400'}`}>
                {breakdown.isMessageLong ? '+20 pts' : '+0'}
              </span>
            </div>

            {/* Buying Intent Keywords */}
            <div className={`flex items-center justify-between p-2 rounded-lg border text-2xs transition-colors ${
              breakdown.hasBuyingIntent ? 'bg-white border-emerald-200 text-emerald-900 font-medium' : 'bg-white/40 border-gray-200/60 text-gray-400'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <Tag className={`h-3 w-3 ${breakdown.hasBuyingIntent ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>Buying Intent Keywords</span>
              </div>
              <span className={`font-bold shrink-0 ${breakdown.hasBuyingIntent ? 'text-emerald-700' : 'text-gray-400'}`}>
                {breakdown.hasBuyingIntent ? '+20 pts' : '+0'}
              </span>
            </div>
          </div>

          {/* Matched Keywords Tags */}
          {breakdown.hasBuyingIntent && breakdown.matchedKeywords.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1 bg-white/70 p-2 rounded-lg border border-emerald-100">
              <span className="text-2xs text-emerald-800 font-semibold">Matched Keywords:</span>
              {breakdown.matchedKeywords.map((kw) => (
                <span key={kw} className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-2xs font-bold font-mono">
                  {kw}
                </span>
              ))}
            </div>
          )}

          <p className="text-2xs text-gray-600 italic mt-1 leading-snug">
            {breakdown.rationale}
          </p>
        </div>
      )}
    </div>
  );
}
