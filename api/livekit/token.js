'use strict';

const handleLiveKitToken = require('../../lib/livekit-token');

module.exports = async (request, response) => {
  try {
    await handleLiveKitToken(request, response);
  } catch (error) {
    if (response.headersSent) return;
    response.statusCode = 503;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: { code: String(error?.message || 'livekit_service_error').slice(0, 80), message: 'LiveKit token service configuration failed.' } }));
  }
};
