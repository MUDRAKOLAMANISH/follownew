import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { 
  handleContactFormEmails, 
  handleUserSignupEmails, 
  getRecentEmailLogs, 
  sendEmailSafely, 
  getAdminEmail 
} from "./server/mailer";
import { executeRAGQuery, retrieveRelevantContext, executeFollowBuddyRAG } from "./server/rag";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

async function generateAnalysis(prompt: string) {
  const schemaConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        intent: { type: "STRING", description: "Customer Intent: High, Medium, or Low" },
        leadScore: { type: "NUMBER", description: "Lead Score: 0 to 100" },
        priority: { type: "STRING", description: "Priority: High, Medium, or Low" },
        suggestedFollowUp: { type: "STRING", description: "Suggested Follow-Up action" },
        suggestedReply: { type: "STRING", description: "Professional suggested reply message" }
      },
      required: ["intent", "leadScore", "priority", "suggestedFollowUp", "suggestedReply"]
    }
  };

  try {
    console.log(`[AI Assistant] Calling generateContent with model: ${PRIMARY_MODEL}`);
    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: schemaConfig
    });
    return response.text;
  } catch (primaryErr: any) {
    console.error(`[AI Assistant] Primary model ${PRIMARY_MODEL} failed:`, primaryErr?.message || primaryErr);
    console.log(`[AI Assistant] Retrying generateContent with fallback model: ${FALLBACK_MODEL}`);
    const fallbackResponse = await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: prompt,
      config: schemaConfig
    });
    return fallbackResponse.text;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/gemini-check", async (req, res) => {
    let usedModel = PRIMARY_MODEL;
    try {
      console.log(`[Gemini Health Check] Testing prompt 'Say Hello' with model: ${PRIMARY_MODEL}`);
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: "Say Hello"
      });
      console.log(`[Gemini Health Check] Success with model: ${PRIMARY_MODEL}, response:`, response.text?.trim());
      res.json({
        status: "ok",
        model: PRIMARY_MODEL,
        prompt: "Say Hello",
        response: response.text?.trim()
      });
    } catch (err: any) {
      console.error(`[Gemini Health Check] Primary ${PRIMARY_MODEL} failed:`, err?.message || err);
      console.log(`[Gemini Health Check] Retrying with fallback model: ${FALLBACK_MODEL}`);
      try {
        usedModel = FALLBACK_MODEL;
        const fallbackRes = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: "Say Hello"
        });
        console.log(`[Gemini Health Check] Fallback success with model: ${FALLBACK_MODEL}, response:`, fallbackRes.text?.trim());
        res.json({
          status: "ok",
          model: FALLBACK_MODEL,
          primaryError: err?.message || "Primary model unavailable",
          prompt: "Say Hello",
          response: fallbackRes.text?.trim()
        });
      } catch (fallbackErr: any) {
        console.error(`[Gemini Health Check] Fallback ${FALLBACK_MODEL} failed:`, fallbackErr?.message || fallbackErr);
        res.status(500).json({
          status: "error",
          attemptedModels: [PRIMARY_MODEL, FALLBACK_MODEL],
          error: fallbackErr?.message || fallbackErr
        });
      }
    }
  });

  app.post("/api/analyze-message", async (req, res) => {
    try {
      const { message, businessProfile, knowledgeContext } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      let businessContext = "";
      if (businessProfile) {
        businessContext = `\nBusiness Context:
- Business Name: ${businessProfile.businessName || 'N/A'}
- Category: ${businessProfile.category || 'N/A'}
- Products: ${businessProfile.products || 'N/A'}
- Services: ${businessProfile.services || 'N/A'}
- WhatsApp / Contact: ${businessProfile.whatsappNumber || businessProfile.contactInformation || 'N/A'}`;
      }

      let ragContext = "";
      if (knowledgeContext && typeof knowledgeContext === "string" && knowledgeContext.trim()) {
        ragContext = `\nKnowledge Base Documentation / Policies:\n${knowledgeContext.slice(0, 3000)}`;
      }

      const prompt = `Analyze this customer message for a business.${businessContext}${ragContext}
Customer message: "${message.trim()}"

Return a JSON object with:
- intent: High, Medium, or Low based on how likely they are to buy.
- leadScore: A number from 0 to 100 based on the message.
- priority: High, Medium, or Low based on urgency and purchase intent.
- suggestedFollowUp: A short, actionable follow-up step for the sales/support team.
- suggestedReply: A professional, helpful reply from the business to the customer, incorporating business knowledge, official document policies, or contact options when appropriate.

Only return valid JSON.`;

      const responseText = await generateAnalysis(prompt);

      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText || "{}");
      } catch (e) {
        console.error("[AI Assistant] Failed to parse JSON", e, responseText);
        return res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("[AI Assistant] Generation failed across all models:", err?.message || err);
      res.status(503).json({ error: "AI service temporarily unavailable. Please try again." });
    }
  });

  app.post("/api/analyze-lead-auto", async (req, res) => {
    try {
      const { message, productInterest, customerName, businessProfile } = req.body;
      const combinedText = `${message || ''} ${productInterest || ''}`.trim();
      
      let businessContext = "";
      if (businessProfile) {
        businessContext = `\nBusiness Details:
- Business: ${businessProfile.businessName || 'Store'}
- Products/Services: ${businessProfile.products || ''}, ${businessProfile.services || ''}`;
      }

      const prompt = `You are an automated lead scoring and status detection AI for small and medium businesses.
Analyze this incoming customer lead inquiry:${businessContext}
Customer Name: ${customerName || 'Prospect'}
Customer Message: "${message || 'Inquiry'}"
Product/Service Interest: "${productInterest || 'General'}"

Evaluate and generate:
1. aiScore: Integer from 0 to 100 representing purchase intent:
   - 90-100: Immediate buying intent (e.g., "I want to buy today", "ready to pay", "send payment link/details", "confirm order")
   - 70-85: High interest / pricing inquiries (e.g., "Need price details", "how much is this", "send catalog", "can I get a discount")
   - 50-65: Moderate interest, questions or stock inquiries (e.g., "Is this in stock?", "Do you have size/color X?", "When will it arrive?")
   - 30-50: Low intent / casual research (e.g., "Just browsing", "looking around", "checking options")
   - 0-25: Not interested / objection / spam (e.g., "Too expensive", "Cancel", "Not interested", "Wrong number")

2. aiStatus: Must be EXACTLY ONE of the following business statuses:
   - "Waiting For Stock": If message mentions stock unavailable, out of stock, or asking when item will arrive.
   - "Interested": If customer asks for price, catalog, quotes, product features, or demonstrates interest.
   - "Follow Up Needed": If customer asks to call later, will buy tomorrow/next week, or needs a reminder.
   - "Price Shared": If quotation or price was sent / requested and is pending reply.
   - "Order Confirmed": If customer confirmed the order, placed order, or is ready for delivery/invoice.
   - "Customer Purchased": If customer has completed purchase or payment.
   - "Not Interested": If customer declined or stated not interested.
   - "New Inquiry": Default for generic inquiries or initial contacts.

3. priority: "High" (if score >= 75), "Normal" (if score 45-74), or "Low" (if score < 45).
4. summary: A 1-sentence summary of what the customer wants.
5. suggestedAction: A practical next action for the shop owner (e.g. "Send catalog & pricing via WhatsApp").

Return a JSON object with:
- aiScore (number)
- aiStatus (string, strictly one of the 8 allowed values)
- priority (string)
- summary (string)
- suggestedAction (string)

Only return valid JSON.`;

      const responseText = await generateAnalysis(prompt);

      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText || "{}");
        // Ensure aiScore is a valid number
        if (typeof parsed.aiScore !== "number" || isNaN(parsed.aiScore)) {
          parsed.aiScore = 70;
        }
        parsed.aiScore = Math.max(0, Math.min(100, Math.round(parsed.aiScore)));
      } catch (e) {
        console.error("[AI Lead Auto] Failed to parse JSON", e, responseText);
        parsed = {
          aiScore: 70,
          aiStatus: "New Inquiry",
          priority: "Normal",
          summary: "Customer inquiry received",
          suggestedAction: "Follow up with customer on WhatsApp"
        };
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("[AI Lead Auto] Failed:", err?.message || err);
      res.status(500).json({ error: "AI scoring temporarily unavailable" });
    }
  });

  app.post("/api/generate-followup", async (req, res) => {
    try {
      const { customerName, customerMessage, leadScore, priority, businessName, businessCategory, products, services, whatsappNumber } = req.body;
      
      const prompt = `You are an expert sales and customer success assistant. Generate a high-converting follow-up outreach for a customer.

Customer Details:
- Name: ${customerName || 'Valued Customer'}
- Customer Message / Context: "${customerMessage || 'Inquired about products/services'}"
- Lead Score: ${leadScore || 50}/100
- Priority: ${priority || 'Normal'}
${businessName ? `- Business Name: ${businessName}` : ''}
${businessCategory ? `- Business Category: ${businessCategory}` : ''}
${products ? `- Available Products: ${products}` : ''}
${services ? `- Services Offered: ${services}` : ''}
${whatsappNumber ? `- WhatsApp Contact: ${whatsappNumber}` : ''}

Generate:
1. subject: A compelling, professional email subject line tailored to this customer.
2. message: A personalized, warm, and concise follow-up message body that directly addresses their inquiry, highlights value, mentions relevant products/services if applicable, and builds trust.
3. callToAction: A clear, frictionless single next step (e.g. "Reply with your convenient time", "Message us on WhatsApp to get the 15% voucher", "Click here to confirm your reservation").

Return a JSON object with:
- subject (string)
- message (string)
- callToAction (string)

Only return valid JSON.`;

      const schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            subject: { type: "STRING", description: "Follow-up email subject line" },
            message: { type: "STRING", description: "Follow-up email message body" },
            callToAction: { type: "STRING", description: "Clear call to action" }
          },
          required: ["subject", "message", "callToAction"]
        }
      };

      let responseText = "";
      try {
        console.log(`[AI Assistant] Generating follow-up with model: ${PRIMARY_MODEL}`);
        const response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: schemaConfig
        });
        responseText = response.text || "";
      } catch (err: any) {
        console.error(`[AI Assistant] Primary ${PRIMARY_MODEL} failed:`, err?.message || err);
        console.log(`[AI Assistant] Retrying follow-up with fallback model: ${FALLBACK_MODEL}`);
        const fallback = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: prompt,
          config: schemaConfig
        });
        responseText = fallback.text || "";
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText || "{}");
      } catch (e) {
        console.error("[AI Assistant] Failed to parse follow-up JSON", e, responseText);
        return res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("[AI Assistant] Follow-up generation failed:", err?.message || err);
      res.status(503).json({ error: "AI service temporarily unavailable. Please try again." });
    }
  });

  app.post("/api/generate-customer-reengagement", async (req, res) => {
    try {
      const { customerName, purchaseHistory, lastContactDate, businessProfile } = req.body;
      
      const purchaseList = Array.isArray(purchaseHistory) && purchaseHistory.length > 0 
        ? purchaseHistory.map((p: any) => `${p.item || 'Item'} (${p.date || 'Past'}${p.amount ? `, $${p.amount}` : ''})`).join(', ')
        : 'Past services and orders';

      const prompt = `You are a VIP customer retention expert. Generate a personalized re-engagement message to reconnect with a returning/past customer.
      
Customer Details:
- Name: ${customerName || 'Valued Customer'}
- Past Purchases / Products Owned: ${purchaseList}
- Last Contacted: ${lastContactDate || 'In the past'}
${businessProfile?.businessName ? `- Business Name: ${businessProfile.businessName}` : ''}
${businessProfile?.category ? `- Business Category: ${businessProfile.category}` : ''}
${businessProfile?.products ? `- New / Featured Products: ${businessProfile.products}` : ''}
${businessProfile?.services ? `- Services: ${businessProfile.services}` : ''}
${businessProfile?.whatsappNumber ? `- WhatsApp: ${businessProfile.whatsappNumber}` : ''}

Generate:
1. subject: A warm, high-open-rate subject line referencing their past relationship or a special returning-customer offer.
2. message: A tailored, conversational message recognizing them as a loyal returning customer, referencing their purchase history, and sharing a genuine check-in, maintenance tip, upgrade opportunity, or loyalty promotion.
3. whatsappText: A shorter 2-3 sentence version suitable for WhatsApp message.
4. callToAction: A clear and effortless next step.

Return a JSON object with:
- subject (string)
- message (string)
- whatsappText (string)
- callToAction (string)

Only return valid JSON.`;

      const schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            subject: { type: "STRING", description: "Re-engagement email subject line" },
            message: { type: "STRING", description: "Re-engagement email body" },
            whatsappText: { type: "STRING", description: "WhatsApp re-engagement message" },
            callToAction: { type: "STRING", description: "Call to action" }
          },
          required: ["subject", "message", "whatsappText", "callToAction"]
        }
      };

      let responseText = "";
      try {
        console.log(`[Customer Re-engagement] Generating with model: ${PRIMARY_MODEL}`);
        const response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: schemaConfig
        });
        responseText = response.text || "";
      } catch (err: any) {
        console.error(`[Customer Re-engagement] Primary ${PRIMARY_MODEL} failed:`, err?.message || err);
        console.log(`[Customer Re-engagement] Retrying with fallback model: ${FALLBACK_MODEL}`);
        const fallback = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: prompt,
          config: schemaConfig
        });
        responseText = fallback.text || "";
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText || "{}");
      } catch (e) {
        console.error("[Customer Re-engagement] Failed to parse JSON", e, responseText);
        return res.status(500).json({ error: "AI service temporarily unavailable. Please try again." });
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("[Customer Re-engagement] Generation failed:", err?.message || err);
      res.status(503).json({ error: "AI service temporarily unavailable. Please try again." });
    }
  });

  // AI Email Generator for Gmail Outreach (Follow-up, Promotional Offer, Thank You)
  app.post("/api/generate-outreach-email", async (req, res) => {
    try {
      const { 
        type = 'follow_up', 
        customerName, 
        customerEmail,
        productInterest, 
        pastPurchases,
        businessName, 
        businessCategory, 
        products, 
        services, 
        discountOffer,
        customPrompt 
      } = req.body;

      let typeGuideline = "";
      if (type === 'promotional') {
        typeGuideline = `Goal: Craft an enticing, high-converting Promotional Offer email.
- Highlight exclusive perks, limited-time benefits, or discount (${discountOffer || 'exclusive VIP customer special offer'}).
- Keep tone energetic, value-driven, and clear. Avoid sounding spammy.
- Emphasize how products/services (${products || 'our catalog'}) solve their exact needs.`;
      } else if (type === 'thank_you') {
        typeGuideline = `Goal: Craft a warm, sincere, relationship-building Thank You email.
- Express genuine appreciation for their business and partnership.
- Mention past interaction or purchase (${pastPurchases || productInterest || 'recent order'}).
- Reaffirm support, invite feedback, and offer an effortless way to reach out anytime.`;
      } else {
        typeGuideline = `Goal: Craft a personalized, professional Follow-Up outreach email.
- Politely reconnect regarding their inquiry or interest in ${productInterest || 'our offerings'}.
- Provide helpful context, clear value, and eliminate friction to continue the conversation.
- Sound natural, friendly, and solution-focused.`;
      }

      const prompt = `You are an elite B2B and B2C sales copywriter for modern businesses.
${typeGuideline}

Business Context:
- Business Name: ${businessName || 'Our Business'}
- Category: ${businessCategory || 'Retail & Services'}
- Featured Products: ${products || 'Standard Products & Collections'}
- Services Offered: ${services || 'Customer Support & Sales'}

Recipient Details:
- Customer Name: ${customerName || 'Valued Customer'}
- Recipient Email: ${customerEmail || ''}
- Product Interest / Context: ${productInterest || 'Inquiry'}
${pastPurchases ? `- Past Purchases / History: ${pastPurchases}` : ''}
${customPrompt ? `- Additional Specific Notes: ${customPrompt}` : ''}

Generate:
1. subject: A compelling, clickable email subject line with high open rates (no spam words).
2. body: A polished, ready-to-send email body with proper greeting, clean paragraph breaks, personalized touch, and professional sign-off.
3. callToAction: A direct, frictionless single call to action.

Return a JSON object with:
- subject (string)
- body (string)
- callToAction (string)

Only return valid JSON.`;

      const schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            subject: { type: "STRING", description: "Email subject line" },
            body: { type: "STRING", description: "Email message body with paragraph breaks" },
            callToAction: { type: "STRING", description: "Clear call to action" }
          },
          required: ["subject", "body", "callToAction"]
        }
      };

      let responseText = "";
      try {
        console.log(`[AI Outreach Email] Generating ${type} email with model: ${PRIMARY_MODEL}`);
        const response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: prompt,
          config: schemaConfig
        });
        responseText = response.text || "";
      } catch (err: any) {
        console.error(`[AI Outreach Email] Primary ${PRIMARY_MODEL} failed:`, err?.message || err);
        console.log(`[AI Outreach Email] Retrying with fallback model: ${FALLBACK_MODEL}`);
        const fallback = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: prompt,
          config: schemaConfig
        });
        responseText = fallback.text || "";
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText || "{}");
      } catch (e) {
        console.error("[AI Outreach Email] Failed to parse JSON", e, responseText);
        return res.status(500).json({ error: "AI email generation temporarily unavailable." });
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("[AI Outreach Email] Generation error:", err?.message || err);
      res.status(503).json({ error: "AI email generator temporarily unavailable." });
    }
  });

  app.post("/api/chat-follow-buddy", async (req, res) => {
    try {
      const { message, conversationHistory, knowledgeDocuments } = req.body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      const docs = Array.isArray(knowledgeDocuments) ? knowledgeDocuments : [];
      
      // Execute strict RAG query grounded on Central Knowledge Base
      const result = await executeFollowBuddyRAG(message, docs);

      res.json({
        reply: result.reply,
        sources: result.sources || [],
        foundInKnowledgeBase: result.foundInKnowledgeBase,
        debugInfo: result.debugInfo,
        suggestedQuestions: [
          "What is FollowFlow AI?",
          "What are the pricing details of FollowFlow AI?",
          "How does Follow-Up work?",
          "Can I use WhatsApp?",
          "What businesses can use this?"
        ]
      });
    } catch (err: any) {
      console.error("[Follow Buddy] Generation failed:", err?.message || err);
      res.status(500).json({
        reply: "I couldn't find that information in the FollowFlow AI knowledge base.",
        sources: [],
        foundInKnowledgeBase: false,
        suggestedQuestions: [
          "What is FollowFlow AI?",
          "What are the pricing details of FollowFlow AI?",
          "How does Follow-Up work?"
        ]
      });
    }
  });

  // ==========================================
  // EMAIL NOTIFICATION SYSTEM ROUTES
  // ==========================================

  // 1. Contact Form Submission Notifications (Admin + User)
  app.post("/api/notifications/contact-submission", async (req, res) => {
    try {
      const { name, email, phone, subject, message, createdAt } = req.body;

      if (!email || !name) {
        return res.status(400).json({ error: "Name and email are required" });
      }

      console.log(`[Notification API] Processing Contact Form from ${name} <${email}>`);
      const logs = await handleContactFormEmails({
        name,
        email,
        phone,
        subject,
        message,
        createdAt
      });

      res.json({
        status: "success",
        message: "Contact notifications processed",
        logs
      });
    } catch (err: any) {
      console.error("[Notification API Error] Contact form dispatch failed:", err?.message || err);
      res.status(500).json({
        status: "error",
        error: err?.message || "Failed to process contact notifications"
      });
    }
  });

  // 2. User Signup Notifications (Admin + User Welcome)
  app.post("/api/notifications/user-signup", async (req, res) => {
    try {
      const { uid, email, displayName, provider, createdAt } = req.body;

      if (!email || !uid) {
        return res.status(400).json({ error: "UID and email are required" });
      }

      console.log(`[Notification API] Processing User Registration for ${displayName || email} (${uid})`);
      const logs = await handleUserSignupEmails({
        uid,
        email,
        displayName,
        provider,
        createdAt
      });

      res.json({
        status: "success",
        message: "Signup notifications processed",
        logs
      });
    } catch (err: any) {
      console.error("[Notification API Error] Signup dispatch failed:", err?.message || err);
      res.status(500).json({
        status: "error",
        error: err?.message || "Failed to process signup notifications"
      });
    }
  });

  // 3. Get Recent Notification Logs
  app.get("/api/notifications/logs", (req, res) => {
    const logs = getRecentEmailLogs();
    res.json({
      logs,
      adminEmail: getAdminEmail(),
      smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    });
  });

  // 4. Test Email Sending
  app.post("/api/notifications/test-email", async (req, res) => {
    try {
      const { to } = req.body;
      const targetEmail = to || getAdminEmail();

      const log = await sendEmailSafely({
        to: targetEmail,
        subject: "FollowFlow AI Test Notification 🧪",
        text: `This is a test notification from FollowFlow AI Email System.\n\nTime: ${new Date().toISOString()}\nStatus: Operational ✅`,
        type: 'test_email',
        details: { triggeredBy: 'admin_test' }
      });

      res.json({
        status: "success",
        log
      });
    } catch (err: any) {
      res.status(500).json({
        status: "error",
        error: err?.message || "Failed to send test email"
      });
    }
  });

  // ==========================================
  // RAG (RETRIEVAL-AUGMENTED GENERATION) ROUTES
  // ==========================================

  // 1. Semantic RAG Query Endpoint
  app.post("/api/rag/query", async (req, res) => {
    try {
      const { query: queryText, documents } = req.body;

      if (!queryText || typeof queryText !== "string" || !queryText.trim()) {
        return res.status(400).json({ error: "Query text is required" });
      }

      console.log(`[RAG API] Processing query: "${queryText.slice(0, 60)}..." against ${documents?.length || 0} docs`);
      const result = await executeRAGQuery(queryText, documents || []);

      res.json(result);
    } catch (err: any) {
      console.error("[RAG API Error] Query failed:", err?.message || err);
      res.status(500).json({
        error: err?.message || "RAG generation temporarily unavailable",
        answer: "Unable to complete semantic search at this moment. Please check uploaded documents."
      });
    }
  });

  // 2. Document Text Extraction Endpoint
  app.post("/api/rag/extract-text", async (req, res) => {
    try {
      const { fileName, fileType, rawContentBase64, textContent } = req.body;

      if (textContent && typeof textContent === "string" && textContent.trim()) {
        return res.json({ text: textContent });
      }

      let extracted = `Document: ${fileName || 'Knowledge File'}\nContent indexed for FollowFlow AI.`;

      if (rawContentBase64 && typeof rawContentBase64 === "string") {
        try {
          console.log(`[RAG Extract] Parsing ${fileName} (${fileType}) with Gemini...`);
          const mime = fileType === "pdf" ? "application/pdf" : "text/plain";
          const genResult = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: mime,
                      data: rawContentBase64
                    }
                  },
                  {
                    text: "Extract and format all text, headers, numbers, policies, and details from this document in clean, readable text/Markdown for RAG knowledge retrieval. Return only the extracted text content."
                  }
                ]
              }
            ]
          });
          if (genResult.text && genResult.text.trim()) {
            extracted = genResult.text.trim();
            console.log(`[RAG Extract] Extracted ${extracted.length} chars from ${fileName}`);
          }
        } catch (aiErr: any) {
          console.warn("[RAG Extract] Gemini extraction fallback:", aiErr?.message || aiErr);
        }
      }

      res.json({ text: extracted });
    } catch (err: any) {
      console.error("[RAG Extract Error]:", err?.message || err);
      res.json({ text: `Document: ${req.body?.fileName || 'File'} indexed.` });
    }
  });

  // 3. RAG System Health Check
  app.get("/api/rag/health", (req, res) => {
    res.json({
      status: "operational",
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      supportedTypes: ["pdf", "docx", "txt", "md"],
      storageBucket: "aiknowledgeassistant05.firebasestorage.app",
      firestoreCollection: "knowledge_base"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
