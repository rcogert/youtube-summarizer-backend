// index.js (for netlify/functions/summarize)

// --- REQUIRED IMPORTS ---
const { Configuration, OpenAI } = require("openai");
const { getTranscript } = require('youtube-transcript-api'); 
const { JSDOM } = require('jsdom'); // This is needed because 'youtube-transcript-api' might require it

// --- IMPORTANT: SET YOUR SECRETS HERE ---
// Get the API key securely from Netlify Environment Variables.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 

// Initialize OpenAI client 🛑 (This line was missing)
// If the key is not set in Netlify, the function will throw a 500 error here.
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Define all necessary CORS headers once
const HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization", 
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
};

exports.handler = async (event) => {
    // Handle Preflight OPTIONS request (CORS check)
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ message: "CORS preflight successful" }) };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method Not Allowed. Use POST." }) };
    }
    
    // Check if the OpenAI client initialized correctly (i.e., if key is present)
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
        
        if (!videoUrl) {
            throw new Error("Missing videoUrl in request body.");
        }
        
        // Use the standard URL class for robust parsing
        const parsedUrl = new URL(videoUrl);
        videoId = parsedUrl.searchParams.get('v'); 

        if (!videoId) {
            throw new Error("Could not extract video ID from URL.");
        }
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
        // Fetch Transcript XML and Parse it
        const transcriptSegments = await getTranscript(videoId, { lang: 'en' });
        
        if (transcriptSegments.length === 0) {
             throw new Error("Video has no available English transcript to summarize.");
        }

        transcriptText = transcriptSegments.map(segment => segment.text).join(' ');
        
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