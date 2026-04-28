window.XHS = window.XHS || {};

window.XHS.wait = (function() {
  const { sleep, sendDebug } = window.XHS.utils;

  async function waitForElement(selector, timeout, label) {
    const name = label || selector;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(300);
    }
    sendDebug(`[TIMEOUT] 等待 "${name}" 超时 | selector: ${selector} | timeout: ${timeout}ms`);
    return null;
  }

  async function waitForElements(selector, timeout, minCount, label) {
    const name = label || selector;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const els = document.querySelectorAll(selector);
      if (els.length >= minCount) return els;
      await sleep(300);
    }
    sendDebug(`[TIMEOUT] 等待 "${name}" 超时 | selector: ${selector} | min: ${minCount} items | timeout: ${timeout}ms`);
    return null;
  }

  return { waitForElement, waitForElements };
})();
