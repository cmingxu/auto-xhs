window.XHS = window.XHS || {};
window.XHS.actions = window.XHS.actions || {};

window.XHS.actions.feed = (function() {
  const S = window.XHS.state;
  const { sleep, random, sendDebug } = window.XHS.utils;
  const { waitForElement, waitForElements } = window.XHS.wait;

  async function waitForResults() {
    sendDebug(`[ACTION] 等待结果容器`, `selector: .feeds-container, timeout: 15s`);
    const container = await waitForElement('.feeds-container', 15000, 'feeds-container');
    if (!container) {
      sendDebug(`[FAIL] 未找到 .feeds-container`, `原因: class 为 'feeds-container' 的元素在 DOM 中不存在`);
      return false;
    }

    const childCount = container.children.length;
    const tagName = container.tagName.toLowerCase();
    sendDebug(`[OK] 找到 .feeds-container`, `tag: <${tagName}>, 子元素数: ${childCount}, visible: ${container.offsetParent !== null}`);

    sendDebug(`[ACTION] 等待容器中的 .note-item`, `selector: .note-item, min: 1, timeout: 20s`);
    const items = await waitForElements('.note-item', 20000, 1, 'note-item');
    if (!items || items.length === 0) {
      sendDebug(`[FAIL] 未出现 .note-item`, `原因: querySelectorAll('.note-item') 在 20 秒内返回 0 个元素`);
      return false;
    }

    // Check visibility of items
    let visibleCount = 0;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) visibleCount++;
    }
    sendDebug(`[OK] 找到 ${items.length} 个 .note-item 元素`, `可见（有尺寸）: ${visibleCount}/${items.length}`);

    await sleep(1000 + random(0, 1500));
    return true;
  }

  function getPostItems() {
    const items = document.querySelectorAll('.note-item');
    const valid = Array.from(items).filter(el => {
      const rect = el.getBoundingClientRect();
      const hasSize = rect.width > 10 && rect.height > 10;
      return hasSize;
    });
    return { all: items.length, visible: valid.length, items: valid };
  }

  async function clickPost(index) {
    let { all, visible, items } = getPostItems();

    sendDebug(`[ACTION] 获取索引 ${index} 处的笔记项`,
      `query: .note-item, DOM 总数: ${all}, 可见（有尺寸）: ${visible}`);

    if (items.length === 0) {
      sendDebug(`[RETRY] 没有有尺寸的 .note-item — 等待 2 秒等待动态渲染`,
        `selector: .note-item, 原因: 所有 ${all} 个元素的 bounding rect 为 0`);
      await sleep(2000);
      const retry = getPostItems();
      items = retry.items;
      all = retry.all;
      visible = retry.visible;
      sendDebug(`[RETRY] 等待 2 秒后`,
        `总数: ${all}, 可见: ${visible}`);

      if (items.length === 0) {
        sendDebug(`[FAIL] 重试后仍无 .note-item`,
          `原因: querySelectorAll('.note-item') 从未返回尺寸 > 10px 的元素`);
        return false;
      }
    }

    if (index >= items.length) {
      sendDebug(`[FAIL] 笔记索引越界`,
        `原因: 索引 ${index} >= 可用 ${items.length} (DOM 总数: ${all})`);
      return false;
    }

    const item = items[index];
    const rect = item.getBoundingClientRect();
    sendDebug(`[ACTION] 将笔记 ${index + 1} 滚动到可视区域`,
      `selector: .note-item[${index}], 位置: (${Math.round(rect.left)},${Math.round(rect.top)}), 尺寸: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500 + random(0, 800));

    // Find a.cover inside this .note-item
    const coverLink = item.querySelector('a.cover');
    if (!coverLink) {
      sendDebug(`[FAIL] 在 .note-item[${index}] 内未找到 a.cover`,
        `原因: 在 note-item 上 querySelector('a.cover') 返回 null`);
      return false;
    }

    const coverRect = coverLink.getBoundingClientRect();
    const coverHref = coverLink.getAttribute('href') || '';
    sendDebug(`[OK] 在 .note-item[${index}] 内找到 a.cover`,
      `href: "${coverHref}", 位置: (${Math.round(coverRect.left)},${Math.round(coverRect.top)}), 尺寸: ${Math.round(coverRect.width)}x${Math.round(coverRect.height)}`);

    // Hover simulation on a.cover
    sendDebug(`[ACTION] 模拟鼠标悬停在 a.cover 上`,
      `触发 'mouseenter' 在 .note-item[${index}] a.cover 上`);
    coverLink.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(100 + random(0, 300));

    sendDebug(`[ACTION] 模拟鼠标移过 a.cover`,
      `触发 'mouseover' 在 .note-item[${index}] a.cover 上`);
    coverLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await sleep(100 + random(0, 200));

    // Click a.cover to navigate to detail page
    sendDebug(`[ACTION] 点击笔记 ${index + 1} 的 a.cover`,
      `调用 .click() 在 .note-item[${index}] a.cover 上 (href: "${coverHref}")`);
    coverLink.click();
    await sleep(800 + random(0, 1200));

    // Wait for detail page — .note-detail-mask is the overlay containing .close-circle and .noteContainer
    sendDebug(`[ACTION] 等待详情页遮罩层`,
      `selector: .note-detail-mask, timeout: 12s`);
    const detailMask = await waitForElement('.note-detail-mask', 12000, '.note-detail-mask');

    if (detailMask) {
      const hasClose = detailMask.querySelector('.close-circle');
      const hasContainer = detailMask.querySelector('.noteContainer');
      sendDebug(`[OK] 详情页已打开`,
        `检测到 .note-detail-mask, 子元素: .close-circle=${!!hasClose}, .noteContainer=${!!hasContainer}`);
      return true;
    } else {
      sendDebug(`[FAIL] 详情页在超时时间内未打开`,
        `原因: document.querySelector('.note-detail-mask') 在 12 秒内未返回元素`);
      return false;
    }
  }

  async function scrollFeed() {
    const MAX_SCROLLS = 10;

    sendDebug(`[ACTION] 滚动搜索结果页`, `加载更多笔记, 最多 ${MAX_SCROLLS} 次滚动`);

    // Find the scrollable feed area
    let scrollArea = document.querySelector('.feeds-container') || document.body;
    const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;

    if (maxScroll <= 5) {
      sendDebug(`[SKIP] 搜索结果无可滚动内容`, `maxScroll: ${maxScroll}px`);
      return;
    }

    let prevItemCount = document.querySelectorAll('.note-item').length;
    sendDebug(`[OK] 初始笔记数`, `${prevItemCount} 篇`);

    for (let i = 0; i < MAX_SCROLLS && !S.stopRequested; i++) {
      const remaining = maxScroll - scrollArea.scrollTop;
      if (remaining <= 0) {
        sendDebug(`[DONE] 已到达底部`, `scrollTop: ${scrollArea.scrollTop}/${maxScroll}`);
        break;
      }

      const stepSize = Math.min(300 + random(0, 200), remaining);
      scrollArea.scrollTop += stepSize;
      const pct = Math.round((scrollArea.scrollTop / maxScroll) * 100);
      sendDebug(`  滚动 ${i + 1}/${MAX_SCROLLS}`, `${pct}%, scrollTop: ${scrollArea.scrollTop}/${maxScroll}`);

      // Wait for lazy-loaded content
      await sleep(1500 + random(0, 1000));

      const newCount = document.querySelectorAll('.note-item').length;
      if (newCount > prevItemCount) {
        sendDebug(`  新笔记加载`, `${prevItemCount} → ${newCount} (+${newCount - prevItemCount})`);
        prevItemCount = newCount;
      }
    }

    const finalCount = document.querySelectorAll('.note-item').length;
    sendDebug(`[OK] 滚动完成`, `总笔记数: ${finalCount}`);
  }

  return { waitForResults, getPostItems, clickPost, scrollFeed };
})();
