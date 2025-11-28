// Netlify function skeleton: getTranscript.js
// Use the YouTube Data API (captions.*) with OAuth credentials to retrieve captions.
// ENV vars required:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN
// Optional:
//   OPENAI_API_KEY (if you want to post-process with OpenAI)

const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

exports.handler = async function (event, context) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const videoId = body.videoId || body.videoUrl ? (body.videoId || new URL(body.videoUrl).searchParams.get('v')) : null;
    if (!videoId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'videoId required' }) };
    }

    // 1) List captions
    const listRes = await youtube.captions.list({
      part: ['id', 'snippet'],
      videoId
    });

    if (!listRes.data.items || listRes.data.items.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'no_captions', message: 'No captions found or captions require authentication' }) };
    }

    // Prefer English
    const english = listRes.data.items.find(it => it.snippet && it.snippet.language && it.snippet.language.startsWith('en')) || listRes.data.items[0];

    // 2) Download the caption track. Use a lower-level client.request if needed with alt=media.
    const res = await youtube.captions.download(
      { id: english.id },
      { responseType: 'stream' }
    ).catch(err => {
      console.error('captions.download error', err);
      throw err;
    });

    let bodyText = '';
    if (res && res.data && typeof res.data.on === 'function') {
      await new Promise((resolve, reject) => {
        res.data.on('data', chunk => (bodyText += chunk.toString()));
        res.data.on('end', resolve);
        res.data.on('error', reject);
      });
    } else if (res && res.data) {
      bodyText = res.data;
    }

    // Return raw caption body (may be timedtext XML or other format)
    return {
      statusCode: 200,
      body: JSON.stringify({ captions: bodyText })
    };
  } catch (err) {
    console.error('getTranscript error', err);
    const message = err && err.message ? err.message : String(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', message }) };
  }
};
