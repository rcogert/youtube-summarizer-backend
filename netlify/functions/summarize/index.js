import { DOMParser } from "xmldom";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    let videoId = body.videoId;

    if (!videoId && body.videoUrl) {
      const match = body.videoUrl.match(/[?&]v=([^&]+)/);
      if (match) videoId = match[1];
    }

    if (!videoId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing videoId or videoUrl" }),
      };
    }

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Summarize this transcript:\n\n${transcript}`,
        },
      ],
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        summary: completion.choices[0].message.content,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
