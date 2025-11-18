import { DOMParser } from "xmldom";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const handler = async (event) => {
  // ---- CORS: Handle Preflight Requests ----
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  // ---- CORS headers for all real POST requests ----
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { videoId } = JSON.parse(event.body || "{}");
    if (!videoId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing videoId" }),
      };
    }

    // --- Try captions API ---
    const captionsRes = await fetch(
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`
    );

    const xml = await captionsRes.text();
    const dom = new DOMParser().parseFromString(xml, "text/xml");
    const texts = dom.getElementsByTagName("text");

    let transcript = "";
    for (let i = 0; i < texts.length; i++) {
      transcript += texts[i].textContent + " ";
    }

    if (!transcript.trim()) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          summary: "This video does not have a transcript available.",
        }),
      };
    }

    // ---- Use OpenAI to summarize ----
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Provide a concise summary of this YouTube transcript:\n\n${transcript}`,
        },
      ],
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ summary: completion.choices[0].message.content }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
