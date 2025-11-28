// index.js (for netlify/functions/summarize)

// --- REQUIRED IMPORTS (Simplified to only the core components) ---
const { Configuration, OpenAI } = require("openai");
const fetch = require('node-fetch'); // Standard way to make external requests
const { DOMParser } = require('xmldom'); // For parsing XML

// --- IMPORTANT: SECURE CONFIGURATION ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Define CORS headers
const HEADERS = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Headers": "Content-Type, Authorization", 
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
};

// --- STABLE TRANSCRIPT FETCH (Using node-fetch directly) ---
async function getTranscriptFromYoutube(videoId) {
    const transcriptApiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;
    
    // Using node-fetch
    const response = await fetch(transcriptApiUrl);
    
    if (!response.ok) {
        throw new Error(`YouTube API returned status ${response.status}.`);
    }

    const xmlText = await response.text();

    if (xmlText.includes('<body>')) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        const textNodes = xmlDoc.getElementsByTagName('text');
        if (textNodes.length === 0) {
            throw new Error("Transcript file is empty.");
        }
        
        let transcript = '';
        for (let i = 0; i < textNodes.length; i++) {
            transcript += textNodes[i].textContent + ' ';
        }
        return transcript.trim();
    } else {
        throw new Error("No English captions available for this video.");
    }
}


exports.handler = async (event) => {
    // 🛑 DEBUG: Log immediate success to verify function startup
    console.log("FUNCTION STARTED SUCCESSFULLY"); 
    
    // Handle OPTIONS request
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ message: "CORS preflight successful" }) };
    }
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method Not Allowed. Use POST." }) };
    }
    
    if (!OPENAI_API_KEY) {
         return {
            statusCode: 500,
            headers: HEADERS,
            body: JSON.stringify({ error: "Server configuration error: OpenAI API Key is missing." }),
        };
    }

    let videoUrl;
    let videoId;
    
    try {
        const body = JSON.parse(event.body);
        videoUrl = body.videoUrl;
        
        if (!videoUrl) throw new Error("Missing videoUrl in request body.");
        
        const parsedUrl = new URL(videoUrl);
        videoId = parsedUrl.searchParams.get('v');

        if (!videoId) throw new Error("Could not extract video ID from URL.");
    } catch (e) {
        // This is the source of the 400 error return
        console.error("Error parsing request body or URL:", e.message);
        return {
            statusCode: 400, 
            headers: HEADERS, 
            body: JSON.stringify({ error: `Invalid request or URL data: ${e.message}` }), 
        };
    }
    
    // 🛑 DEBUG: Log video ID extraction success
    console.log("Video ID extracted:", videoId);

    // ... (Transcript fetch and OpenAI call logic follows) ...
    // Since the 502 occurs before this, we trust the logic below is stable
    
    let transcriptText = "";
    
    try {
        transcriptText = await getTranscriptFromYoutube(videoId);
        
        if (transcriptText.length < 50) { 
             throw new Error("Transcript is too short to summarize.");
        }
        
    } catch (e) {
        console.error("Transcript Error:", e.message);
        return {
            statusCode: 404, 
            headers: HEADERS, 
            body: JSON.stringify({ error: "Could not retrieve transcript.", details: e.message }),
        };
    }
    
    try {
        const prompt = `Summarize the following YouTube video transcript concisely and clearly in two short paragraphs. Transcript: \n\n${transcriptText}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a professional summarization AI." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
        });

        const summary = completion.choices[0].message.content;

        return {
            statusCode: 200,
            headers: HEADERS,
            body: JSON.stringify({ summary: summary }),
        };

    } catch (e) {
        console.error("OpenAI Error:", e.message);
        return {
            statusCode: 500, 
            headers: HEADERS, 
            body: JSON.stringify({ error: "OpenAI summarization failed.", details: e.message }),
        };
    }
};