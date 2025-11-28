// index.js (for netlify/functions/summarize)

// --- REQUIRED IMPORTS ---
const { Configuration, OpenAI } = require("openai");
const ytSearch = require('yt-search'); // Stable library for finding video data
const { DOMParser } = require('xmldom'); // Used for parsing XML transcript
const fetch = require('node-fetch'); // Standard way to make external requests

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

// --- CORE FUNCTION ---

async function getTranscriptFromYoutube(videoId) {
    // This is the direct, unauthenticated API endpoint for English captions
    const transcriptApiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;
    
    // 1. Fetch the XML data
    const response = await fetch(transcriptApiUrl);
    
    if (!response.ok) {
        throw new Error(`YouTube API returned status ${response.status}.`);
    }

    const xmlText = await response.text();

    // 2. Check for "No captions" message in the XML (common failure mode)
    if (xmlText.includes('<body>')) {
        // Successful transcript found, parse it
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        const textNodes = xmlDoc.getElementsByTagName('text');
        if (textNodes.length === 0) {
            throw new Error("Transcript file is empty.");
        }
        
        // 3. Extract text from XML nodes
        let transcript = '';
        for (let i = 0; i < textNodes.length; i++) {
            transcript += textNodes[i].textContent + ' ';
        }
        return transcript.trim();
    } else {
        // This usually means captions were requested but not found for the language
        throw new Error("No English captions available for this video.");
    }
}


exports.handler = async (event) => {
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
        console.error("Error parsing request body or URL:", e.message);
        return {
            statusCode: 400, 
            headers: HEADERS, 
            body: JSON.stringify({ error: `Invalid request or URL data: ${e.message}` }), 
        };
    }

    let transcriptText = "";
    
    try {
        // 🛑 FIX: Use the new, stable transcript fetching method
        transcriptText = await getTranscriptFromYoutube(videoId);
        
        if (transcriptText.length < 50) { // Check for meaningful content
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
    
    // 4. Call OpenAI to Summarize
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