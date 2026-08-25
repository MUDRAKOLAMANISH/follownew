import { GoogleGenAI } from "@google/genai";
import { RAGChunkMatch, RAGDiagnosticReport } from "../src/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

export const NOT_FOUND_RESPONSE = "I couldn't find that information in the FollowFlow AI knowledge base.";

export interface DocPayload {
  id: string;
  fileName: string;
  fileType: string;
  extractedText: string;
  fileUrl?: string;
  fileSize?: number;
  chunkCount?: number;
  status?: string;
}

export interface ChunkWithScore {
  docId: string;
  fileName: string;
  fileType: string;
  fileUrl?: string;
  chunkText: string;
  score: number;
  relevancePercentage: number;
  chunkIndex: number;
}

// Built-in Central Product Specification as comprehensive baseline knowledge
export const DEFAULT_PRODUCT_DOCUMENT: DocPayload = {
  id: "default-followflow-guide",
  fileName: "FollowFlow_AI_Official_Guide.md",
  fileType: "md",
  extractedText: `# FollowFlow AI - Official Product Documentation & Knowledge Base

## 1. Product Overview & Mission
FollowFlow AI (formerly LeadPilot AI) is an intelligent AI-powered sales management, customer follow-up, and CRM automation platform designed for retail stores, jewelry shops, clothing boutiques, service businesses, and local shops. It helps business owners and sales teams convert customer inquiries into confirmed orders and build long-term repeat customer relationships.

## 2. Pricing Details & Subscription Plans
FollowFlow AI offers transparent, flexible pricing tiers tailored for small businesses and growing teams:
- **Free Trial**: 14-day free trial with 100 AI lead score evaluations, 50 WhatsApp follow-up message generations, and full CRM access. No credit card required to start.
- **Starter Plan ($29/month)**: Designed for single retail stores and local boutiques. Includes up to 500 active leads, automated AI lead scoring (0-100), dynamic priority tagging, WhatsApp message generation, and email outreach.
- **Growth / Pro Plan ($79/month)**: Ideal for high-volume stores and multi-member sales teams. Includes unlimited leads, permanent customer database, automated 30/60/90-day customer re-engagement campaigns, Gmail integration, and team collaboration.
- **Enterprise Plan (Custom / $199+/month)**: Dedicated account manager, custom AI training on your product catalog, priority SLA support, and advanced Multi-Role Access Control (RBAC).
- **Book a Demo**: Prospective clients can click "Book a Demo" or "Get Started" on the website navigation bar to schedule a live walkthrough and receive customized onboarding.

## 3. Smart Lead Management & AI Scoring
- **Real-Time Intake**: Captures inquiries from WhatsApp, web forms, walk-ins, phone calls, and social ads.
- **Dynamic AI Lead Scoring (0-100)**: Automatically calculates purchase intent and urgency:
  - 90-100: Hot Lead - Immediate buying intent (ready to pay or confirm order).
  - 70-85: Warm Lead - High interest, requested price details or product catalog.
  - 40-65: Moderate Lead - Inquiring about stock availability or sizing.
  - 0-35: Cold Lead - Casual browsing or objection.
- **Priority Classification**: High, Normal, and Low priority tags to guide sales reps on who to contact first.

## 4. Automated Follow-Up Engine & Messaging Channels
- **Automated Follow-Up Reminders**: Generates customized follow-up reminders and scheduled outreach so no lead is forgotten.
- **WhatsApp Integration**: Generates customized, localized WhatsApp follow-up messages that can be copied or opened directly in WhatsApp with one click.
- **Gmail & Email Outreach**: Generates high-converting subject lines, personalized follow-up bodies, and frictionless calls to action. Direct Gmail API integration allows one-click sending.
- **Localized Messaging**: Messages can be adapted to tone, business category, and customer purchase history.

## 5. Permanent Customer Database & Retention
- **Converted Customer Retention**: When a lead purchases, they are archived in the Customer Database with full purchase history, lifetime value (LTV), past inquiries, and preferences.
- **Automated Re-Engagement**: Automated alerts when customers have not purchased for 30, 60, or 90 days with customized returning-customer offers.

## 6. Sales Pipeline Stages
Customer deals progress through 7 distinct pipeline stages:
1. New Inquiry - Initial inbound message or lead capture.
2. Interested - Customer inquired about product details, catalog, or pricing.
3. Follow Up Needed - Scheduled follow-up outreach required.
4. Price Shared - Quotation, pricing, or catalog sent to customer.
5. Waiting For Stock - Customer awaiting inventory arrival or restock.
6. Order Confirmed - Customer confirmed purchase intent and order specifications.
7. Customer Purchased - Deal completed and customer archived to permanent database.

## 7. Target Audience & Business Types
Tailored specifically for:
- Jewelry shops, diamond merchants, and luxury goods boutiques
- Fashion, apparel, and clothing stores
- Local retail stores and wholesale distributors
- Professional service businesses (salons, wellness clinics, consulting)
- Small and medium business sales teams

## 8. Multi-Role Access Control (RBAC) & Knowledge Base
- **Role Isolation**: Business Owner, Sales Manager, and Super Admin roles with isolated permissions.
- **Super Admin Central Knowledge Base**: Super Admin managed RAG vector store for document indexing and intelligent query retrieval.
- **Follow Buddy AI Assistant**: Built-in guide grounded directly in the central knowledge base to answer questions about FollowFlow AI features, pricing plans, workflows, and documentation.`
};

// Common stop words to exclude from isolated token scoring
const STOP_WORDS = new Set([
  "the", "and", "is", "a", "an", "for", "to", "in", "of", "on", "with", 
  "what", "how", "can", "do", "i", "you", "my", "our", "are", "it", "this", 
  "that", "does", "from", "about", "who", "which", "there", "their", "will", "would",
  "give", "tell", "show", "me", "some", "any"
]);

// Semantic synonyms and stem expansions for robust domain matching
const SYNONYM_MAP: Record<string, string[]> = {
  price: ["pricing", "cost", "costs", "plan", "plans", "subscription", "tier", "tiers", "fee", "fees", "rate", "trial", "dollar", "$"],
  pricing: ["price", "cost", "costs", "plan", "plans", "subscription", "tier", "tiers", "fee", "fees", "rate", "trial", "dollar", "$"],
  cost: ["price", "pricing", "cost", "costs", "plan", "plans", "subscription", "tier", "tiers", "rate"],
  plan: ["pricing", "price", "plans", "tier", "tiers", "subscription", "starter", "pro", "growth", "enterprise", "trial"],
  detail: ["details", "breakdown", "overview", "information", "specification", "features", "structure"],
  details: ["detail", "breakdown", "overview", "information", "specification", "features", "structure"],
  lead: ["leads", "inquiry", "inquiries", "prospect", "prospects", "scoring", "score"],
  scoring: ["score", "scores", "scored", "rating", "intent", "priority", "temperature"],
  followup: ["follow-up", "follow", "reminder", "reminders", "outreach", "schedule"],
  whatsapp: ["chat", "message", "messages", "messaging", "contact"],
  email: ["gmail", "outreach", "template", "templates", "mail"],
  customer: ["customers", "client", "clients", "database", "retention", "re-engagement", "history"],
  feature: ["features", "capabilities", "functionality", "workflow", "tools"]
};

function getStems(word: string): string[] {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  const stems = [clean];
  if (clean.endsWith("ing") && clean.length > 4) stems.push(clean.slice(0, -3));
  if (clean.endsWith("s") && clean.length > 3) stems.push(clean.slice(0, -1));
  if (clean.endsWith("es") && clean.length > 4) stems.push(clean.slice(0, -2));
  if (clean.endsWith("ed") && clean.length > 4) stems.push(clean.slice(0, -2));
  return stems;
}

/**
 * Score relevance of a document chunk against a user query using multi-tier semantic & token matching
 */
export function scoreChunkRelevance(query: string, chunk: string): number {
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const queryTerms = cleanQuery.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  
  if (queryTerms.length === 0) {
    return chunk.toLowerCase().includes(query.toLowerCase().trim()) ? 5 : 0;
  }

  const lowerChunk = chunk.toLowerCase();
  let score = 0;
  let termMatches = 0;

  // 1. Exact full query phrase match bonus (+15)
  if (cleanQuery.length > 3 && lowerChunk.includes(cleanQuery)) {
    score += 15;
  }

  // 2. Multi-word n-gram match bonuses (e.g. "price details", "followflow ai", "lead scoring")
  for (let i = 0; i < queryTerms.length - 1; i++) {
    const pair = `${queryTerms[i]} ${queryTerms[i + 1]}`;
    if (lowerChunk.includes(pair)) {
      score += 8;
    }
  }

  // 3. Individual term & synonym matching
  for (const term of queryTerms) {
    let matchedThisTerm = false;

    // Direct token word-boundary match
    const directRegex = new RegExp(`\\b${term}\\b`, "i");
    if (directRegex.test(lowerChunk)) {
      score += 4;
      matchedThisTerm = true;
    } else if (lowerChunk.includes(term)) {
      score += 2.5;
      matchedThisTerm = true;
    }

    // Stem matching
    const stems = getStems(term);
    for (const st of stems) {
      if (!matchedThisTerm && st.length > 2 && lowerChunk.includes(st)) {
        score += 2;
        matchedThisTerm = true;
        break;
      }
    }

    // Synonym mapping
    const syns = SYNONYM_MAP[term] || [];
    for (const syn of syns) {
      if (lowerChunk.includes(syn)) {
        score += 1.8;
        matchedThisTerm = true;
        break;
      }
    }

    if (matchedThisTerm) {
      termMatches++;
    }
  }

  // 4. Header match bonus: if chunk contains a Markdown header matching any query term (+6)
  const headerMatch = lowerChunk.match(/^#+\s+.*$/gm);
  if (headerMatch) {
    for (const h of headerMatch) {
      for (const term of queryTerms) {
        if (h.includes(term)) {
          score += 6;
          break;
        }
      }
    }
  }

  if (termMatches === 0 && score === 0) {
    return 0;
  }

  // Coverage bonus: reward chunks that match a higher percentage of query terms
  const coverageRatio = termMatches / queryTerms.length;
  score = score * (0.5 + 0.5 * coverageRatio);

  return Math.round(score * 10) / 10;
}

/**
 * Split text into semantic overlapping chunks (~600 chars with 120 char overlap)
 */
export function chunkTextContent(text: string, chunkSize = 600, overlap = 120): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    // Prefer breaking at paragraph or sentence boundary
    if (end < clean.length) {
      const nextParagraph = clean.indexOf("\n\n", end - 100);
      if (nextParagraph !== -1 && nextParagraph < end + 100) {
        end = nextParagraph;
      } else {
        const nextPeriod = clean.indexOf(". ", end - 60);
        if (nextPeriod !== -1 && nextPeriod < end + 60) {
          end = nextPeriod + 1;
        }
      }
    }

    const chunkContent = clean.slice(start, end).trim();
    if (chunkContent.length > 25) {
      chunks.push(chunkContent);
    }

    start = end - overlap;
    if (start >= clean.length - overlap) break;
  }

  return chunks;
}

/**
 * Extract relevant context chunks from knowledge documents
 */
export function retrieveRelevantContext(
  query: string, 
  documents: DocPayload[], 
  topK = 5,
  minScore = 1.0
): ChunkWithScore[] {
  const allChunks: ChunkWithScore[] = [];
  
  // Combine custom documents with default product guide if not already included
  const allDocs = [...documents];
  if (!allDocs.some(d => d.fileName === DEFAULT_PRODUCT_DOCUMENT.fileName)) {
    allDocs.push(DEFAULT_PRODUCT_DOCUMENT);
  }

  for (const doc of allDocs) {
    const text = doc.extractedText || "";
    if (!text.trim()) continue;

    const rawChunks = chunkTextContent(text, 600, 120);

    rawChunks.forEach((chunkText, chunkIndex) => {
      const score = scoreChunkRelevance(query, chunkText);
      if (score >= minScore) {
        // Calculate a normalized relevance percentage (e.g. 50% - 99%)
        const relevancePercentage = Math.min(99, Math.max(45, Math.round(score * 4 + 30)));
        allChunks.push({
          docId: doc.id,
          fileName: doc.fileName,
          fileType: doc.fileType || "doc",
          fileUrl: doc.fileUrl,
          chunkText,
          score,
          relevancePercentage,
          chunkIndex
        });
      }
    });
  }

  // Sort by score descending and return top K
  allChunks.sort((a, b) => b.score - a.score);
  return allChunks.slice(0, topK);
}

/**
 * Generate a comprehensive 5-stage RAG Diagnostic Report for Super Admins
 */
export function generateRAGDiagnosticReport(
  queryText: string,
  documents: DocPayload[],
  matchedChunks: ChunkWithScore[],
  finalPrompt: string,
  modelUsed: string,
  responseLength: number
): RAGDiagnosticReport {
  const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const queryTerms = cleanQuery.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));

  const allDocs = [...documents];
  if (!allDocs.some(d => d.fileName === DEFAULT_PRODUCT_DOCUMENT.fileName)) {
    allDocs.push(DEFAULT_PRODUCT_DOCUMENT);
  }

  const docsWithText = allDocs.filter(d => (d.extractedText || "").trim().length > 0);
  const totalChars = allDocs.reduce((acc, d) => acc + (d.extractedText?.length || 0), 0);
  const totalChunks = allDocs.reduce((acc, d) => acc + chunkTextContent(d.extractedText || "").length, 0);

  const topScore = matchedChunks.length > 0 ? matchedChunks[0].score : 0;
  let reasonIfEmpty: string | undefined = undefined;

  if (matchedChunks.length === 0) {
    if (allDocs.length === 0) {
      reasonIfEmpty = "No knowledge base documents found in Firestore collection 'knowledge_base'.";
    } else if (docsWithText.length === 0) {
      reasonIfEmpty = "Knowledge base documents exist, but their 'extractedText' field is empty.";
    } else {
      reasonIfEmpty = `None of the ${totalChunks} indexed chunks scored above the relevance threshold (1.0) for query terms: [${queryTerms.join(", ")}].`;
    }
  }

  const chunkMatches: RAGChunkMatch[] = matchedChunks.map(c => ({
    docId: c.docId,
    fileName: c.fileName,
    fileType: c.fileType,
    fileUrl: c.fileUrl,
    chunkText: c.chunkText,
    score: c.score,
    relevancePercentage: c.relevancePercentage,
    chunkIndex: c.chunkIndex
  }));

  return {
    uploadStatus: {
      collection: "knowledge_base",
      totalDocuments: allDocs.length,
      readyCount: allDocs.filter(d => d.status === "ready" || !d.status).length,
      status: allDocs.length > 0 ? "connected" : "empty",
      documents: allDocs.map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: d.fileSize || d.extractedText?.length || 0,
        extractedTextLength: d.extractedText?.length || 0,
        chunkCount: chunkTextContent(d.extractedText || "").length,
        status: d.status || "ready"
      }))
    },
    extractionStatus: {
      totalExtractedChars: totalChars,
      documentsWithText: docsWithText.length,
      documentsMissingText: allDocs.length - docsWithText.length,
      status: docsWithText.length === allDocs.length && totalChars > 0 ? "healthy" : "warning",
      details: `${docsWithText.length} of ${allDocs.length} documents have valid extractedText (${totalChars.toLocaleString()} total characters parsed).`
    },
    chunkingStatus: {
      totalChunksGenerated: totalChunks,
      chunkSize: 600,
      overlap: 120,
      status: totalChunks > 0 ? "healthy" : "empty",
      details: `Generated ${totalChunks} semantic chunks with 600-character windows and 120-character overlap across all documents.`
    },
    retrievalStatus: {
      query: queryText,
      queryTerms,
      matchedChunksCount: matchedChunks.length,
      topScore,
      thresholdUsed: 1.0,
      status: matchedChunks.length > 0 ? "found" : "no_matches",
      reasonIfEmpty,
      matchedChunks: chunkMatches
    },
    groundingStatus: {
      modelUsed,
      contextProvided: matchedChunks.length > 0,
      finalPrompt,
      responseLength,
      status: matchedChunks.length > 0 ? "grounded" : "fallback_not_found",
      details: matchedChunks.length > 0 
        ? `Prompt successfully grounded with ${matchedChunks.length} relevant chunks from ${Array.from(new Set(matchedChunks.map(c => c.fileName))).join(", ")}.`
        : `No grounding context available. Returned exact refusal fallback.`
    }
  };
}

/**
 * Strict RAG Query Generator for Follow Buddy with Diagnostic Instrumentation
 */
export async function executeFollowBuddyRAG(
  message: string,
  documents: DocPayload[]
): Promise<{
  reply: string;
  sources: string[];
  foundInKnowledgeBase: boolean;
  debugInfo?: {
    matchedChunks?: RAGChunkMatch[];
    topScore?: number;
    queryTerms?: string[];
    finalPrompt?: string;
    reasonIfEmpty?: string;
    diagnosticReport?: RAGDiagnosticReport;
  };
}> {
  const trimmed = message.trim();

  // 1. Check for simple greetings
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy|greetings)[\s!.]*$/i.test(trimmed)) {
    const defaultPrompt = "User greeting";
    const report = generateRAGDiagnosticReport(trimmed, documents, [], defaultPrompt, PRIMARY_MODEL, 120);
    return {
      reply: "Hello! I'm Follow Buddy, your AI sales assistant for FollowFlow AI. Ask me anything about our features, pricing plans, lead management, WhatsApp follow-ups, or customer workflows.",
      sources: [],
      foundInKnowledgeBase: true,
      debugInfo: {
        matchedChunks: [],
        topScore: 0,
        queryTerms: [trimmed.toLowerCase()],
        finalPrompt: "Handled by greeting intent router.",
        diagnosticReport: report
      }
    };
  }

  // 2. Retrieve relevant chunks from Central Knowledge Base
  const relevantChunks = retrieveRelevantContext(trimmed, documents, 4, 1.0);

  if (relevantChunks.length === 0) {
    console.log(`[Follow Buddy RAG] No relevant chunks found for query: "${trimmed}"`);
    const emptyPrompt = "No context chunks retrieved.";
    const report = generateRAGDiagnosticReport(trimmed, documents, [], emptyPrompt, PRIMARY_MODEL, 0);
    return {
      reply: NOT_FOUND_RESPONSE,
      sources: [],
      foundInKnowledgeBase: false,
      debugInfo: {
        matchedChunks: [],
        topScore: 0,
        queryTerms: trimmed.toLowerCase().split(/\s+/).filter(t => !STOP_WORDS.has(t)),
        finalPrompt: emptyPrompt,
        reasonIfEmpty: report.retrievalStatus.reasonIfEmpty,
        diagnosticReport: report
      }
    };
  }

  // Deduplicate source document names
  const sourceDocNames = Array.from(new Set(relevantChunks.map(c => c.fileName)));

  const contextBlock = relevantChunks
    .map((c, i) => `[Source ${i + 1}: ${c.fileName} | Score: ${c.score}]\n${c.chunkText}`)
    .join("\n\n---\n\n");

  const prompt = `You are "Follow Buddy", the official AI assistant for FollowFlow AI.
Answer the user's question accurately and helpfully using ONLY the knowledge base chunks provided below.

CRITICAL RULES:
1. STRICT GROUNDING: Use ONLY the provided knowledge chunks below.
2. NO HALLUCINATIONS: Do not assume or fabricate details not present in the chunks.
3. PRICING & DETAILS: When asked about pricing or plans, explicitly outline the tiers (Free Trial, Starter $29/mo, Pro $79/mo, Enterprise) and demo options mentioned in the context.
4. UNKNOWN INFO: If the provided chunks do not contain the answer, you MUST respond EXACTLY with:
"${NOT_FOUND_RESPONSE}"
5. TONE & FORMAT: Clear, friendly, professional, and well-structured with bullet points where appropriate.

=== RETRIEVED KNOWLEDGE BASE CHUNKS ===
${contextBlock}
=======================================

User Question: "${trimmed}"`;

  try {
    console.log(`[Follow Buddy RAG] Generating strictly grounded answer using ${relevantChunks.length} chunks from:`, sourceDocNames);
    
    let answer = "";
    let modelUsed = PRIMARY_MODEL;

    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: prompt
      });
      answer = response.text?.trim() || "";
    } catch (primaryErr) {
      console.warn(`[Follow Buddy RAG] Primary model retry with fallback...`);
      modelUsed = FALLBACK_MODEL;
      const fallbackRes = await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: prompt
      });
      answer = fallbackRes.text?.trim() || "";
    }

    if (!answer || answer.includes(NOT_FOUND_RESPONSE)) {
      const report = generateRAGDiagnosticReport(trimmed, documents, relevantChunks, prompt, modelUsed, 0);
      return {
        reply: NOT_FOUND_RESPONSE,
        sources: [],
        foundInKnowledgeBase: false,
        debugInfo: {
          matchedChunks: relevantChunks.map(c => ({
            docId: c.docId,
            fileName: c.fileName,
            fileType: c.fileType,
            fileUrl: c.fileUrl,
            chunkText: c.chunkText,
            score: c.score,
            relevancePercentage: c.relevancePercentage,
            chunkIndex: c.chunkIndex
          })),
          topScore: relevantChunks[0]?.score || 0,
          queryTerms: trimmed.toLowerCase().split(/\s+/).filter(t => !STOP_WORDS.has(t)),
          finalPrompt: prompt,
          reasonIfEmpty: "Gemini determined the context did not sufficiently answer the specific inquiry.",
          diagnosticReport: report
        }
      };
    }

    const report = generateRAGDiagnosticReport(trimmed, documents, relevantChunks, prompt, modelUsed, answer.length);

    return {
      reply: answer,
      sources: sourceDocNames,
      foundInKnowledgeBase: true,
      debugInfo: {
        matchedChunks: relevantChunks.map(c => ({
          docId: c.docId,
          fileName: c.fileName,
          fileType: c.fileType,
          fileUrl: c.fileUrl,
          chunkText: c.chunkText,
          score: c.score,
          relevancePercentage: c.relevancePercentage,
          chunkIndex: c.chunkIndex
        })),
        topScore: relevantChunks[0]?.score || 0,
        queryTerms: trimmed.toLowerCase().split(/\s+/).filter(t => !STOP_WORDS.has(t)),
        finalPrompt: prompt,
        diagnosticReport: report
      }
    };
  } catch (err: any) {
    console.error("[Follow Buddy RAG Error]:", err?.message || err);
    const report = generateRAGDiagnosticReport(trimmed, documents, relevantChunks, prompt, PRIMARY_MODEL, 0);
    return {
      reply: NOT_FOUND_RESPONSE,
      sources: [],
      foundInKnowledgeBase: false,
      debugInfo: {
        matchedChunks: [],
        topScore: 0,
        queryTerms: trimmed.toLowerCase().split(/\s+/).filter(t => !STOP_WORDS.has(t)),
        finalPrompt: prompt,
        reasonIfEmpty: `Error during generation: ${err?.message || err}`,
        diagnosticReport: report
      }
    };
  }
}

/**
 * Perform RAG generation with Gemini for Knowledge Base Query Sandbox & Debug Panel
 */
export async function executeRAGQuery(queryText: string, documents: DocPayload[]) {
  const relevantChunks = retrieveRelevantContext(queryText, documents, 6, 0.8);
  const hasContext = relevantChunks.length > 0;

  let contextString = "";
  if (hasContext) {
    contextString = relevantChunks
      .map((c, i) => `[Source ${i + 1}: ${c.fileName} | Relevance Score: ${c.score}]\n${c.chunkText}`)
      .join("\n\n---\n\n");
  } else if (documents.length > 0) {
    contextString = documents
      .map(d => `[Document: ${d.fileName} (${d.fileType})]\n${d.extractedText.slice(0, 1000)}`)
      .join("\n\n---\n\n");
  }

  const prompt = `You are FollowFlow AI's Knowledge Base RAG Assistant. 
Answer the user's question accurately using ONLY the retrieved knowledge documents provided below.
When asked about pricing or plans, explicitly state the tier names, dollar amounts ($29/mo Starter, $79/mo Pro, Enterprise), and trial details found in the context.

=== KNOWLEDGE BASE RETRIEVED CONTEXT ===
${contextString || "No matching documents found in knowledge base."}
========================================

User Question: "${queryText}"

Instructions:
1. Provide a direct, well-formatted, professional answer.
2. Explicitly cite source document names when referencing facts (e.g. "According to FollowFlow_AI_Official_Guide.md...").
3. Use bullet points or numbered lists where appropriate for readability.`;

  let answerText = "";
  let modelUsed = PRIMARY_MODEL;

  try {
    console.log(`[RAG Server Sandbox] Executing RAG query with model ${PRIMARY_MODEL}`);
    const res = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt
    });
    answerText = res.text?.trim() || "";
  } catch (err: any) {
    console.error(`[RAG Server Sandbox] Primary model failed:`, err?.message || err);
    modelUsed = FALLBACK_MODEL;
    const fallbackRes = await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: prompt
    });
    answerText = fallbackRes.text?.trim() || "";
  }

  const sources = relevantChunks.map(c => ({
    docId: c.docId,
    fileName: c.fileName,
    fileType: c.fileType,
    snippet: c.chunkText.length > 200 ? c.chunkText.slice(0, 200) + "..." : c.chunkText,
    relevanceScore: c.relevancePercentage,
    fileUrl: c.fileUrl,
    chunkIndex: c.chunkIndex
  }));

  const report = generateRAGDiagnosticReport(
    queryText,
    documents,
    relevantChunks,
    prompt,
    modelUsed,
    answerText.length
  );

  return {
    answer: answerText,
    sources,
    query: queryText,
    modelUsed,
    contextFound: hasContext,
    debugInfo: {
      matchedChunks: relevantChunks.map(c => ({
        docId: c.docId,
        fileName: c.fileName,
        fileType: c.fileType,
        fileUrl: c.fileUrl,
        chunkText: c.chunkText,
        score: c.score,
        relevancePercentage: c.relevancePercentage,
        chunkIndex: c.chunkIndex
      })),
      topScore: relevantChunks[0]?.score || 0,
      queryTerms: queryText.toLowerCase().split(/\s+/).filter(t => !STOP_WORDS.has(t)),
      finalPrompt: prompt,
      reasonIfEmpty: report.retrievalStatus.reasonIfEmpty,
      diagnosticReport: report
    }
  };
}
