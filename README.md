# ICP Document Reviewer

A devil's advocate document reviewer that checks if your docs are relevant to your Ideal Customer Profile (ICP) and suggests improvements.

## Features
- Upload PDF, Word (.docx), plain text, or images
- 5 built-in ICP profiles (Enterprise SaaS, SMB/Startup, Developer, Healthcare, E-commerce)
- Custom ICP support
- Devil's advocate critiques
- Specific improvement suggestions
- Screenshot / visual analysis feedback
- ICP fit score with dimension breakdown

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set your Anthropic API key
```bash
# Mac/Linux
export ANTHROPIC_API_KEY=sk-ant-...

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

Get your API key at https://console.anthropic.com

### 3. Start the server
```bash
npm start
```

Then open http://localhost:3000 in your browser.

### Development mode (auto-restart on changes)
```bash
npm run dev
```

## Notes
- Files up to 20 MB are supported
- PDFs and images are sent directly to Claude for visual analysis (screenshots inside PDFs are analyzed too)
- Word/DOCX files have their text extracted and analyzed
- Uploaded files are deleted from the server immediately after analysis
