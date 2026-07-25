(function attachMobilePolicy(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SokomindMobile = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  // Visibility API integration — pauses/resumes solver when tab is hidden/shown.
  function createVisibilityMonitor(onHidden, onVisible) {
    let hidden = false;
    let handler = null;

    function start() {
      if (handler) return;
      if (typeof document === "undefined") return;
      hidden = document.visibilityState === "hidden";
      handler = () => {
        const nowHidden = document.visibilityState === "hidden";
        if (nowHidden === hidden) return;
        hidden = nowHidden;
        if (hidden && typeof onHidden === "function") onHidden();
        if (!hidden && typeof onVisible === "function") onVisible();
      };
      document.addEventListener("visibilitychange", handler);
    }

    function stop() {
      if (!handler) return;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handler);
      }
      handler = null;
    }

    function isHidden() {
      return hidden;
    }

    return { start, stop, isHidden };
  }

  // Memory pressure monitoring — detects when device memory is under pressure.
  function createMemoryMonitor(thresholdRatio) {
    if (thresholdRatio === undefined || thresholdRatio === null) thresholdRatio = 0.8;
    let underPressure = false;
    let lastCheckedBytes = 0;
    let limitBytes = Infinity;

    function check() {
      // Try performance.measureUserAgentSpecificMemory (async, Chrome only)
      // Fall back to non-standard performance.memory (Chrome only)
      if (typeof performance !== "undefined" && performance.memory) {
        const mem = performance.memory;
        lastCheckedBytes = mem.usedJSHeapSize || 0;
        limitBytes = mem.jsHeapSizeLimit || Infinity;
        underPressure = limitBytes > 0 && (lastCheckedBytes / limitBytes) >= thresholdRatio;
      }
      return {
        usedBytes: lastCheckedBytes,
        limitBytes,
        ratio: limitBytes > 0 ? lastCheckedBytes / limitBytes : 0,
        underPressure,
      };
    }

    function isUnderPressure() {
      return underPressure;
    }

    return { check, isUnderPressure };
  }

  // Checkpoint-on-throttle detection — detects when the browser throttles
  // setTimeout/setInterval intervals, which happens when a tab is backgrounded
  // or under heavy load.
  function createThrottleDetector(expectedInterval, onThrottled) {
    let throttled = false;
    let lastTick = 0;

    function tick() {
      const current = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (lastTick > 0) {
        const elapsed = current - lastTick;
        // If the actual interval exceeds 3x the expected interval, we're throttled
        const wasThrottled = throttled;
        throttled = elapsed > expectedInterval * 3;
        if (throttled && !wasThrottled && typeof onThrottled === "function") {
          onThrottled({ elapsed, expected: expectedInterval });
        }
      }
      lastTick = current;
      return { throttled, lastTick };
    }

    function isThrottled() {
      return throttled;
    }

    return { tick, isThrottled };
  }

  return { createVisibilityMonitor, createMemoryMonitor, createThrottleDetector };
});
