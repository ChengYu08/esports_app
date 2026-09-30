export function nextVoicePlayback(currentVoiceUrl, requestedVoiceUrl) {
  return currentVoiceUrl === requestedVoiceUrl ? null : requestedVoiceUrl;
}
