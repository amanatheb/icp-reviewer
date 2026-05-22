require("dotenv").config();
const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 20 * 1024 * 1024 } });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static('public'));

const ICP_PROFILES = {
  enterprise_saas: `ICP: Enterprise SaaS buyer. 1000+ employees. Decision-makers: VP/C-suite + IT/procurement. Pain points: scalability, security, compliance, integrations. Long sales cycles (3–12 months). Evaluates ROI, TCO, vendor stability. Values case studies, security docs, implementation plans. Concerns: data privacy, downtime, change management.`,
  smb: `ICP: SMB/Startup buyer. 10–200 employees. Decision-maker: founder or ops lead. Pain points: cost, ease of use, time-to-value. Short cycles (days–weeks). Evaluates pricing, simplicity, support. Values demos, free trials, transparent pricing. Concerns: budget, learning curve, lock-in.`,
  developer: `ICP: Developer/Technical buyer. Role: engineer or CTO. Pain points: poor APIs, bad docs, slow perf, no customization. Evaluates by trying the product. Values: open source friendliness, API docs, SDKs, community. Concerns: lock-in, rate limits, reliability, pricing at scale.`,
  healthcare: `ICP: Healthcare buyer. Hospitals, clinics. Decision-makers: CMO, CIO, compliance officers. Pain points: HIPAA, interoperability, patient data security. Long procurement. Values: certifications, audit trails, HL7/FHIR. Concerns: regulatory risk, data breaches, clinical workflow disruption.`,
  ecommerce: `ICP: E-commerce buyer. Founder, CMO, or head of growth. Pain points: cart abandonment, CAC, retention, inventory sync. Values: fast integration, Shopify/WooCommerce compat, real-time analytics. Concerns: downtime during peaks, data accuracy, attribution.`,
};

app.post('/analyze', upload.single('file'), async (req, res) => {
  const { icp_id, custom_icp, context } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded.' });
  if (!icp_id) return res.status(400).json({ error: 'No ICP selected.' });

  const icpText = icp_id === 'custom'
    ? (custom_icp || 'Custom ICP not provided')
    : ICP_PROFILES[icp_id];

  if (!icpText) return res.status(400).json({ error: 'Invalid ICP profile.' });

  try {
    const fileBuffer = fs.readFileSync(file.path);
    const base64Data = fileBuffer.toString('base64');
    const mime = file.mimetype;

    let userContent = [];

    // Attach file based on type
    if (mime === 'application/pdf') {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } });
    } else if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/webp') {
      const imgMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
      userContent.push({ type: 'image', source: { type: 'base64', media_type: imgMime, data: base64Data } });
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mime === 'text/plain') {
      // For docx/txt, try to read as text
      try {
        const text = fileBuffer.toString('utf-8');
        userContent.push({ type: 'text', text: 'DOCUMENT CONTENT:\n' + text });
      } catch (e) {
        userContent.push({ type: 'text', text: '[Binary document — analyze based on filename: ' + file.originalname + ']' });
      }
    } else {
      userContent.push({ type: 'text', text: '[File: ' + file.originalname + ' — type: ' + mime + ']' });
    }

    const prompt = `You are a rigorous document reviewer acting as a devil's advocate. Critically evaluate this document against the ICP below and respond ONLY with a valid JSON object (no markdown, no backticks, no preamble).

ICP PROFILE:
${icpText}
${context ? '\nADDITIONAL CONTEXT:\n' + context : ''}

Respond with exactly this JSON structure:
{
  "overall_verdict": "one sharp honest sentence",
  "icp_fit_score": <0-100>,
  "scores": {
    "messaging_clarity": <0-100>,
    "icp_alignment": <0-100>,
    "value_proposition": <0-100>,
    "tone_and_language": <0-100>
  },
  "devil_advocate_critiques": ["critique 1", "critique 2", "critique 3"],
  "improvement_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "screenshot_feedback": ["visual/image observation — or note if no images found"],
  "strongest_aspect": "what the doc does best",
  "biggest_risk": "the single most damaging gap vs the ICP"
}`;

    userContent.push({ type: 'text', text: prompt });

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = response.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.json({ success: true, result, icp_name: icp_id === 'custom' ? 'Custom ICP' : icp_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) });
  } catch (err) {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error(err);
    res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ICP Reviewer running at http://localhost:${PORT}`));
