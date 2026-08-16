// netlify/functions/critique.js
//
// Receives { image, mediaType, skill } from the browser, calls the
// Anthropic API server-side using the secret key stored in Netlify's
// environment variables, and returns the critique text. The API key
// never reaches the browser.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  const { image, mediaType, skill } = payload;
  if (!image || !mediaType || !skill) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing image, mediaType, or skill" }) };
  }

  const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!supportedTypes.includes(mediaType)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          "Unsupported image format (" +
          mediaType +
          "). Please upload a JPEG, PNG, WebP, or GIF — HEIC photos from iPhones need to be converted first."
      })
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: "Server is missing ANTHROPIC_API_KEY" };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
              {
                type: "text",
                text:
                  "You are a warm, encouraging beginner watercolour teacher. This student just practiced this week's skill: " +
                  skill +
                  ". Look at their practice photo and reply in under 150 words with: two specific things they did well related to this skill, then two specific, actionable suggestions to improve at this particular skill. Keep it concrete and kind, no generic praise."
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error ? data.error.message : "Anthropic API error" })
      };
    }

    const text = (data.content || []).map((block) => block.text || "").join("\n").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text || "No feedback came back — try again in a moment." })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
