window.XHS = window.XHS || {};

window.XHS.utils = (function() {
  const S = window.XHS.state;

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function sendMessage(msg) {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  function incrementStat(statName, value = 1) {
    sendMessage({ type: 'incrementStat', stat: statName, value });
  }

  function updateStatus(step, message) {
    S.currentStep = step;
    sendMessage({
      type: 'statusUpdate',
      step,
      message,
      keyword: S.currentKeyword
    });
  }

  function sendDebug(message, detail) {
    sendMessage({
      type: 'debugLog',
      message,
      detail: detail || '',
      timestamp: Date.now(),
      step: S.currentStep,
      keyword: S.currentKeyword
    });
  }

  return { sleep, random, sendMessage, incrementStat, updateStatus, sendDebug };
})();
