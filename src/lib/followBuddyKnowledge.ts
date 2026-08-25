// FollowFlow AI Website Knowledge Base for Follow Buddy

export interface KnowledgeItem {
  keywords: string[];
  patterns: RegExp[];
  answer: string;
  suggestedNext?: string[];
}

export const SUGGESTED_QUESTIONS = [
  "What is FollowFlow AI?",
  "How does Follow-Up work?",
  "Can I use WhatsApp?",
  "How do I manage customers?",
  "What businesses can use this?"
];

export const UNRELATED_REFUSAL = 
  "I'm Follow Buddy and can help only with questions related to FollowFlow AI, sales management, customer follow-ups, and website features.";

export const LOCAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  // 1. What is FollowFlow AI?
  {
    keywords: ["what is followflow", "what is followflow ai", "about followflow", "what does followflow do", "overview", "what is this app", "what is this platform"],
    patterns: [
      /what\s+is\s+followflow/i,
      /about\s+followflow/i,
      /tell\s+me\s+about\s+followflow/i,
      /what\s+does\s+(this|it|followflow)\s+do/i,
      /what\s+is\s+this\s+(app|website|software|crm|platform|tool)/i
    ],
    answer: "FollowFlow AI helps businesses manage leads, customers, follow-ups, and sales communication from one dashboard.",
    suggestedNext: ["How does Follow-Up work?", "Can I use WhatsApp?", "What businesses can use this?"]
  },

  // 2. How does Follow-Up work?
  {
    keywords: ["how does follow-up work", "how do follow ups work", "follow up automation", "how does follow up work", "follow-up process", "followup reminder"],
    patterns: [
      /how\s+does\s+(the\s+)?follow[\s-]?up(s)?\s+work/i,
      /how\s+do\s+follow[\s-]?ups\s+work/i,
      /follow[\s-]?up\s+reminders?/i,
      /how\s+to\s+follow[\s-]?up/i,
      /follow[\s-]?up\s+process/i
    ],
    answer: "When a customer inquiry is received, FollowFlow AI helps create follow-up reminders, WhatsApp messages, and email outreach so no lead is forgotten.",
    suggestedNext: ["Can I use WhatsApp?", "What is Lead Scoring?", "How do I manage customers?"]
  },

  // 3. WhatsApp messages / communication
  {
    keywords: ["whatsapp", "can i send whatsapp", "whatsapp follow up", "whatsapp messages", "can i use whatsapp", "whatsapp integration"],
    patterns: [
      /can\s+i\s+(send|use)\s+whatsapp/i,
      /whatsapp/i,
      /send\s+whatsapp\s+message/i,
      /whatsapp\s+follow[\s-]?up/i
    ],
    answer: "Yes. FollowFlow AI supports WhatsApp-based customer follow-ups and communication workflows.",
    suggestedNext: ["Can I send Email follow-ups?", "How does Follow-Up work?", "What is Lead Scoring?"]
  },

  // 4. What businesses can use this?
  {
    keywords: ["what businesses can use this", "who can use this", "target audience", "industries", "who is this for", "retail", "shops", "jewelry", "clothing"],
    patterns: [
      /what\s+business(es)?\s+can\s+use\s+this/i,
      /who\s+(can\s+use|is\s+this\s+for)/i,
      /is\s+this\s+for\s+my\s+business/i,
      /suitable\s+for/i,
      /which\s+industr(y|ies)/i
    ],
    answer: "Retail stores, jewelry shops, clothing stores, service businesses, local shops, and small businesses can use FollowFlow AI.",
    suggestedNext: ["What is FollowFlow AI?", "How do I get started?", "How do I manage customers?"]
  },

  // 5. Customer Database / Managing Customers
  {
    keywords: ["how do i manage customers", "customer database", "customer management", "manage customers", "customer history", "re-engagement"],
    patterns: [
      /how\s+do\s+i\s+manage\s+customers/i,
      /customer\s+(database|management|history|tracking)/i,
      /re[\s-]?engagement/i,
      /converted\s+customers?/i
    ],
    answer: "FollowFlow AI provides a permanent Customer Database where converted leads are retained with their full purchase history, past inquiries, and communication timeline.",
    suggestedNext: ["How does Follow-Up work?", "What is Lead Scoring?", "What is FollowFlow AI?"]
  },

  // 6. Lead Management & Scoring
  {
    keywords: ["lead scoring", "lead score", "how does lead scoring work", "ai lead scoring", "lead management"],
    patterns: [
      /lead\s+scor(e|ing)/i,
      /how\s+does\s+lead\s+score\s+work/i,
      /lead\s+management/i,
      /prioritize\s+leads/i
    ],
    answer: "FollowFlow AI automatically analyzes incoming customer inquiries, assigns a purchase intent score (0-100), and classifies priority so your team can focus on the hottest buyers first.",
    suggestedNext: ["How does Follow-Up work?", "Can I use WhatsApp?", "What is FollowFlow AI?"]
  },

  // 7. Email Follow-Ups
  {
    keywords: ["email", "email follow ups", "can i send email", "email outreach", "email templates"],
    patterns: [
      /email\s+follow[\s-]?ups?/i,
      /can\s+i\s+send\s+email/i,
      /email\s+(templates?|outreach)/i
    ],
    answer: "Yes! FollowFlow AI generates personalized, high-converting email subject lines and message drafts that you can send directly or copy with one click.",
    suggestedNext: ["Can I use WhatsApp?", "How does Follow-Up work?", "What is FollowFlow AI?"]
  },

  // 8. Business Profile
  {
    keywords: ["business profile", "business profile management", "custom business", "setup profile"],
    patterns: [
      /business\s+profile/i,
      /how\s+to\s+setup\s+business/i,
      /profile\s+management/i
    ],
    answer: "The Business Profile lets you configure your company name, category, products, services, and WhatsApp contact so the AI crafts perfectly tailored messages for your brand.",
    suggestedNext: ["What is FollowFlow AI?", "What businesses can use this?"]
  },

  // 9. Pricing & Plans
  {
    keywords: ["price", "pricing", "cost", "how much", "plans", "subscription", "free trial", "price details of followflow ai", "pricing details"],
    patterns: [
      /how\s+much\s+(does\s+it\s+cost|is\s+it)/i,
      /pric(e|ing)\s*(details|plans?)?/i,
      /cost(s)?/i,
      /plans?/i,
      /subscription/i,
      /free\s+trial/i
    ],
    answer: "FollowFlow AI offers flexible pricing tiers:\n• Free Trial: 14-day full access with 100 AI lead score evaluations & 50 WhatsApp follow-ups.\n• Starter Plan ($29/month): Up to 500 active leads, AI lead scoring (0-100), WhatsApp message generation, and email outreach.\n• Growth / Pro Plan ($79/month): Unlimited leads, permanent customer database, 30/60/90-day customer re-engagement campaigns, and Gmail outreach.\n• Enterprise Plan (Custom / $199+/mo): Dedicated manager, custom AI training, and custom RBAC.\nClick 'Get Started' or 'Book a Demo' to begin!",
    suggestedNext: ["How do I get started?", "What is FollowFlow AI?", "Can I use WhatsApp?"]
  },

  // 10. Getting Started / Demo / Onboarding
  {
    keywords: ["how do i get started", "how to start", "sign up", "try it", "demo", "book a demo"],
    patterns: [
      /how\s+do\s+i\s+(get\s+started|start|sign\s+up)/i,
      /how\s+to\s+try/i,
      /book\s+a\s+demo/i,
      /demo/i
    ],
    answer: "You can click 'Get Started' or 'Book a Demo' at the top of the page to create your free account, configure your business profile, and start adding leads immediately!",
    suggestedNext: ["What is FollowFlow AI?", "What businesses can use this?"]
  },

  // 11. Automated Sales Pipeline
  {
    keywords: ["sales pipeline", "automated pipeline", "pipeline", "pipeline stages"],
    patterns: [
      /sales\s+pipeline/i,
      /automated\s+pipeline/i,
      /pipeline\s+stages?/i
    ],
    answer: "FollowFlow AI tracks each customer through clear pipeline stages: New Inquiry, Interested, Follow Up Needed, Price Shared, Waiting For Stock, Order Confirmed, and Customer Purchased.",
    suggestedNext: ["How does Follow-Up work?", "How do I manage customers?"]
  }
];

// Check if query is completely off-topic (e.g. sports, weather, politics, general coding, celebrities, math trivia)
const OFF_TOPIC_REGEX = [
  /who\s+won/i,
  /cricket|football|soccer|baseball|nba|ipl|fifa|super\s?bowl/i,
  /weather|rain|temperature|forecast/i,
  /capital\s+of/i,
  /president|prime\s+minister|election|politics/i,
  /recipe|how\s+to\s+cook|bake/i,
  /movie|celebrity|actor|song|singer/i,
  /write\s+(a\s+python|a\s+c\+\+|javascript\s+code\s+for)/i,
  /tell\s+me\s+a\s+joke/i,
  /who\s+is\s+(einstein|elon|messi|ronaldo|modi|biden|trump)/i,
  /solve\s+\d+/i
];

export function getLocalFollowBuddyAnswer(userQuery: string): {
  answer: string;
  suggestedNext?: string[];
  isOffTopic?: boolean;
  matchedLocally: boolean;
} {
  const clean = userQuery.trim().toLowerCase();

  // 1. Check for known greetings
  if (/^(hi|hello|hey|greetings|hola|namaste|good\s+(morning|afternoon|evening))\b/i.test(clean) && clean.length < 25) {
    return {
      answer: "👋 Hi there! I'm Follow Buddy, your AI Sales Assistant. How can I help you explore FollowFlow AI today?",
      suggestedNext: SUGGESTED_QUESTIONS.slice(0, 3),
      matchedLocally: true
    };
  }

  // 2. Check for thank you / compliments
  if (/^(thanks|thank\s+you|awesome|great|cool|nice|perfect|good\s+job)\b/i.test(clean) && clean.length < 30) {
    return {
      answer: "You're very welcome! Feel free to ask more questions about FollowFlow AI or click 'Get Started' above to try it out.",
      suggestedNext: ["What is FollowFlow AI?", "What businesses can use this?"],
      matchedLocally: true
    };
  }

  // 3. Check for obvious off-topic queries
  for (const regex of OFF_TOPIC_REGEX) {
    if (regex.test(clean)) {
      return {
        answer: UNRELATED_REFUSAL,
        suggestedNext: SUGGESTED_QUESTIONS.slice(0, 3),
        isOffTopic: true,
        matchedLocally: true
      };
    }
  }

  // 4. Exact match or pattern match against Knowledge Base
  for (const item of LOCAL_KNOWLEDGE_BASE) {
    // Check regex patterns
    for (const pat of item.patterns) {
      if (pat.test(clean)) {
        return {
          answer: item.answer,
          suggestedNext: item.suggestedNext,
          matchedLocally: true
        };
      }
    }

    // Check keyword inclusion
    for (const kw of item.keywords) {
      if (clean.includes(kw) || kw.includes(clean)) {
        return {
          answer: item.answer,
          suggestedNext: item.suggestedNext,
          matchedLocally: true
        };
      }
    }
  }

  // 5. Broad product-related word checks
  if (clean.includes("whatsapp")) {
    return {
      answer: "Yes. FollowFlow AI supports WhatsApp-based customer follow-ups and communication workflows.",
      suggestedNext: ["How does Follow-Up work?", "What is Lead Scoring?"],
      matchedLocally: true
    };
  }

  if (clean.includes("follow") || clean.includes("reminder")) {
    return {
      answer: "When a customer inquiry is received, FollowFlow AI helps create follow-up reminders, WhatsApp messages, and email outreach so no lead is forgotten.",
      suggestedNext: ["Can I use WhatsApp?", "What is Lead Scoring?"],
      matchedLocally: true
    };
  }

  if (clean.includes("lead") || clean.includes("inquir")) {
    return {
      answer: "FollowFlow AI allows you to capture incoming leads, automatically scores their purchase readiness, and schedules timely follow-ups.",
      suggestedNext: ["What is Lead Scoring?", "How do I manage customers?"],
      matchedLocally: true
    };
  }

  if (clean.includes("customer") || clean.includes("client")) {
    return {
      answer: "FollowFlow AI provides a permanent Customer Database where converted leads are retained with their full purchase history, past inquiries, and communication timeline.",
      suggestedNext: ["What is FollowFlow AI?", "What businesses can use this?"],
      matchedLocally: true
    };
  }

  if (clean.includes("retail") || clean.includes("jewelry") || clean.includes("clothing") || clean.includes("shop") || clean.includes("store")) {
    return {
      answer: "Retail stores, jewelry shops, clothing stores, service businesses, local shops, and small businesses can use FollowFlow AI.",
      suggestedNext: ["What is FollowFlow AI?", "How does Follow-Up work?"],
      matchedLocally: true
    };
  }

  // Not strictly matched locally
  return {
    answer: "",
    matchedLocally: false
  };
}
