window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.search = (function() {
  const { sleep, random, sendDebug } = window.XHS.utils;
  const { waitForElement } = window.XHS.wait;

  async function performSearch(keyword) {
    const SEL = '#search-input';
    sendDebug(`[ACTION] 查找搜索输入框`, `selector: ${SEL}, timeout: 10s`);
    const searchInput = await waitForElement(SEL, 10000, 'search-input');
    if (!searchInput) {
      sendDebug(`[FAIL] 未找到搜索输入框`, `原因: document.querySelector('${SEL}') 在 10 秒后返回 null`);
      return false;
    }

    const tag = searchInput.tagName.toLowerCase();
    const type = searchInput.getAttribute('type') || 'text';
    const placeholder = searchInput.getAttribute('placeholder') || '';
    const visible = searchInput.offsetParent !== null;
    sendDebug(`[OK] 找到搜索输入框`, `tag: <${tag}>, type: "${type}", placeholder: "${placeholder}", visible: ${visible}`);

    // Clear existing text
    sendDebug(`[ACTION] 清空搜索输入框`, `将 value 设为 "" 并触发 'input' 事件`);
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);

    // Type character by character
    sendDebug(`[ACTION] 逐字输入关键词`, `关键词: "${keyword}", 字符数: ${keyword.length}, 输入方式: 逐字符输入`);
    for (let ci = 0; ci < keyword.length; ci++) {
      const char = keyword[ci];
      searchInput.value += char;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      const delay = 60 + random(0, 120);
      if (ci < 3 || ci === keyword.length - 1) {
        sendDebug(`  输入字符[${ci}]: "${char}"`, `input.value 当前: "${searchInput.value}", delay: ${delay}ms`);
      }
      await sleep(delay);
    }

    await sleep(300 + random(0, 300));
    sendDebug(`[ACTION] 触发搜索 — 派发 Enter keydown+press+up`);

    // Enter key sequence
    const enterEvents = ['keydown', 'keypress', 'keyup'];
    for (const evt of enterEvents) {
      searchInput.dispatchEvent(new KeyboardEvent(evt, {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
      }));
      sendDebug(`  已派发 "${evt}" 事件`, `目标: #search-input, key: Enter`);
      await sleep(100);
    }

    sendDebug(`[OK] 搜索已触发`, `关键词: "${keyword}"`);
    return true;
  }

  return { performSearch };
})();
