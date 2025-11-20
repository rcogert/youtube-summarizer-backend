// index.js (for netlify/functions/summarize)

// --- REQUIRED IMPORTS ---
// NOTE: Make sure these are listed in your netlify.toml under 'external_node_modules'
const { Configuration, OpenAI } = require("openai");
const { getTranscript } = require('youtube-transcript-api'); 
const { JSDOM } = require('jsdom'); // Used for parsing the XML transcript
const url = require('url'); // Node's built-in URL parser

// --- IMPORTANT: SET YOUR SECRETS HERE ---
// It is strongly recommended to use Netlify Environment Variables instead of hardcoding.
// If you MUST hardcode for testing, replace 'YOUR_OPENAI_API_KEY_HERE'.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY_HERE";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Define all necessary CORS headers once
const HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization", // Added Authorization for better security practice
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
};

exports.handler = async (event) => {
    // 1. 🛑 FIX: Handle Preflight OPTIONS request (CORS check)
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200, // Must return 200 OK status
            headers: HEADERS,
            body: JSON.stringify({ message: "CORS preflight successful" }),
        };
    }

    // Ensure it's a POST request for actual summarization
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers: HEADERS,
            body: JSON.stringify({ error: "Method Not Allowed. Use POST." }),
        };
    }

    let videoUrl;
    let videoId;
    
    try {
        const body = JSON.parse(event.body);
        videoUrl = body.videoUrl;
        
        // 2. Extract Video ID from the URL
        if (!videoUrl) {
            throw new Error("Missing videoUrl in request body.");
        }
        
        const url_parts = url.parse(videoUrl, true);
        videoId = url_parts.query.v;

        if (!videoId) {
            throw new Error("Could not extract video ID from URL.");
        }
    } catch (e) {
        console.error("Error parsing request body or URL:", e.message);
        return {
            statusCode: 400,
            headers: HEADERS,
            body: JSON.stringify({ error: `Invalid request format: ${e.message}` }),
        };
    }

    let transcriptText = "";
    
    try {
        // 3. Fetch Transcript XML and Parse it
        // The getTranscript function handles fetching the XML from the timedtext API
        // and parsing it. We'll use the result to build a simple text string.
        const transcriptSegments = await getTranscript(videoId, { lang: 'en' });
        
        if (transcriptSegments.length === 0) {
            // 💡 REFINEMENT: Graceful handling for videos without captions
             throw new Error("Video has no available English transcript to summarize.");
        }

        // Concatenate text from segments to form the full transcript
        transcriptText = transcriptSegments.map(segment => segment.text).join(' ');
        
    } catch (e) {
        console.error("Transcript Error:", e.message);
        return {
            statusCode: 404,
            headers: HEADERS,
            body: JSON.stringify({ 
                error: "Could not retrieve transcript.", 
                details: e.message 
            }),
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

        // 5. Return Summary to Client
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