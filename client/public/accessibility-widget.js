(function () {
  "use strict";

  var CFG = {
    apiStatement: "/api/accessibility-statement",
    apiFeedback: "/api/accessibility-feedback",
    apiAudit: "/api/accessibility-audit",
    defaultLang: "he",
  };

  var $ = function(sel, root) { return (root || document).querySelector(sel); };
  var $$ = function(sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch(e) { return null; }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function setCSSVar(name, value) {
    document.documentElement.style.setProperty(name, value);
  }

  function addClass(c) { document.documentElement.classList.add(c); }
  function removeClass(c) { document.documentElement.classList.remove(c); }

  function focusFirstFocusable(root) {
    var focusable = root.querySelector(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();
  }

  function trapFocus(modalEl) {
    var focusable = $$(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      modalEl
    ).filter(function(el) { return !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"; });

    if (focusable.length === 0) return function() {};

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    function onKeyDown(e) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    modalEl.addEventListener("keydown", onKeyDown);
    return function() { modalEl.removeEventListener("keydown", onKeyDown); };
  }

  function audit(action, component, details) {
    try {
      fetch(CFG.apiAudit, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action, component: component, details: details })
      }).catch(function() {});
    } catch(e) {}
  }

  var KEY = "acc_2026_state";
  var defaultState = {
    fontScale: 1,
    highContrast: false,
    grayscale: false,
    underlineLinks: false,
    reduceMotion: false,
    focusRing: true,
    dyslexiaFont: false
  };

  function loadState() {
    var s = safeJsonParse(localStorage.getItem(KEY));
    return Object.assign({}, defaultState, s || {});
  }

  function saveState(st) {
    localStorage.setItem(KEY, JSON.stringify(st));
  }

  function applyState(st) {
    setCSSVar("--acc-font-scale", String(st.fontScale));
    st.highContrast ? addClass("acc-contrast") : removeClass("acc-contrast");
    st.grayscale ? addClass("acc-grayscale") : removeClass("acc-grayscale");
    st.underlineLinks ? addClass("acc-underline") : removeClass("acc-underline");
    st.reduceMotion ? addClass("acc-reduce-motion") : removeClass("acc-reduce-motion");
    st.focusRing ? addClass("acc-focus") : removeClass("acc-focus");
    st.dyslexiaFont ? addClass("acc-dyslexia") : removeClass("acc-dyslexia");
  }

  function injectStyles() {
    var css = '\
:root {\
  --acc-font-scale: 1;\
  --acc-focus-color: #000;\
  --acc-focus-offset: 3px;\
  font-size: calc(16px * var(--acc-font-scale));\
}\
.acc-grayscale body { filter: grayscale(1) !important; }\
.acc-underline a { text-decoration: underline !important; text-underline-offset: 3px; }\
.acc-reduce-motion * {\
  animation-duration: 0.001ms !important;\
  animation-iteration-count: 1 !important;\
  transition-duration: 0.001ms !important;\
  scroll-behavior: auto !important;\
}\
.acc-focus :focus {\
  outline: 3px solid var(--acc-focus-color) !important;\
  outline-offset: var(--acc-focus-offset) !important;\
}\
.acc-contrast body {\
  background: #fff !important;\
  color: #000 !important;\
}\
.acc-contrast * {\
  background-color: transparent !important;\
  color: #000 !important;\
  border-color: #000 !important;\
  box-shadow: none !important;\
}\
.acc-dyslexia body {\
  font-family: Arial, system-ui, sans-serif !important;\
  letter-spacing: 0.02em !important;\
}\
.acc-btn {\
  position: fixed;\
  z-index: 999999;\
  left: 18px;\
  bottom: 18px;\
  width: 56px;\
  height: 56px;\
  border-radius: 18px;\
  border: 1px solid rgba(0,0,0,0.2);\
  background: #fff;\
  color: #000;\
  font-weight: 900;\
  cursor: pointer;\
  font-size: 22px;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);\
}\
.acc-btn:focus { outline: 3px solid #000; outline-offset: 3px; }\
.acc-btn svg { width: 28px; height: 28px; }\
.acc-panel {\
  position: fixed;\
  z-index: 999999;\
  left: 18px;\
  bottom: 84px;\
  width: min(360px, calc(100vw - 36px));\
  max-height: calc(100vh - 120px);\
  overflow-y: auto;\
  border-radius: 18px;\
  border: 1px solid rgba(0,0,0,0.2);\
  background: #fff;\
  color: #000;\
  box-shadow: 0 18px 50px rgba(0,0,0,0.18);\
  padding: 14px;\
  display: none;\
}\
.acc-panel[aria-hidden="false"] { display: block; }\
.acc-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.08); }\
.acc-row:last-child { border-bottom: none; }\
.acc-title { font-weight: 900; font-size: 14px; }\
.acc-sub { font-size: 12px; opacity: 0.75; }\
.acc-toggle {\
  display: inline-flex;\
  align-items: center;\
  gap: 8px;\
}\
.acc-toggle input { width: 18px; height: 18px; }\
.acc-actions { display: flex; gap: 10px; flex-wrap: wrap; padding-top: 10px; }\
.acc-smallbtn {\
  border: 1px solid rgba(0,0,0,0.2);\
  background: #fff;\
  color: #000;\
  border-radius: 12px;\
  padding: 10px 12px;\
  cursor: pointer;\
  font-weight: 800;\
  font-size: 12px;\
}\
.acc-smallbtn:focus { outline: 3px solid #000; outline-offset: 3px; }\
.acc-modal {\
  position: fixed;\
  inset: 0;\
  z-index: 999999;\
  display: none;\
  align-items: center;\
  justify-content: center;\
  background: rgba(0,0,0,0.55);\
  padding: 18px;\
}\
.acc-modal[aria-hidden="false"] { display: flex; }\
.acc-modal-card {\
  width: min(720px, 100%);\
  max-height: calc(100vh - 60px);\
  overflow-y: auto;\
  background: #fff;\
  color: #000;\
  border-radius: 18px;\
  border: 1px solid rgba(0,0,0,0.2);\
  box-shadow: 0 24px 80px rgba(0,0,0,0.25);\
  overflow: hidden;\
}\
.acc-modal-top {\
  display: flex;\
  justify-content: space-between;\
  align-items: center;\
  padding: 14px 14px;\
  border-bottom: 1px solid rgba(0,0,0,0.1);\
}\
.acc-modal-top strong { font-weight: 950; }\
.acc-close {\
  width: 40px; height: 40px;\
  border-radius: 12px;\
  border: 1px solid rgba(0,0,0,0.2);\
  background: #fff;\
  cursor: pointer;\
  font-weight: 900;\
}\
.acc-close:focus { outline: 3px solid #000; outline-offset: 3px; }\
.acc-modal-body { padding: 14px; }\
.acc-modal-body p { margin: 0 0 10px; line-height: 1.6; }\
.acc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\
@media (max-width: 720px) { .acc-grid { grid-template-columns: 1fr; } }\
.acc-box {\
  border: 1px solid rgba(0,0,0,0.12);\
  border-radius: 14px;\
  padding: 12px;\
}\
.acc-box h3 { margin: 0 0 6px; font-size: 13px; font-weight: 900; }\
.acc-box small { opacity: 0.75; }\
.acc-form label { display: block; font-weight: 800; margin: 10px 0 6px; font-size: 12px; }\
.acc-form input, .acc-form textarea {\
  width: 100%;\
  border: 1px solid rgba(0,0,0,0.2);\
  border-radius: 12px;\
  padding: 10px 10px;\
  font-size: 14px;\
  box-sizing: border-box;\
}\
.acc-form textarea { min-height: 110px; resize: vertical; }\
.acc-alert { margin-top: 10px; padding: 10px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.2); }\
.acc-alert[role="alert"] { background: #fff; }\
';
    var style = document.createElement("style");
    style.setAttribute("data-acc-2026", "true");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildUI(state) {
    var btn = document.createElement("button");
    btn.className = "acc-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Accessibility controls");
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="m4.24 10.5 3.38-.68a6 6 0 0 0 .88 0h8.96a6 6 0 0 0 .88 0l3.38.68"/><path d="M12 10v4"/><path d="m8 21 2.78-5.56"/><path d="m16 21-2.78-5.56"/></svg>';

    var panel = document.createElement("div");
    panel.className = "acc-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Accessibility panel");

    panel.innerHTML = '\
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">\
        <div>\
          <div class="acc-title">\u05E0\u05D2\u05D9\u05E9\u05D5\u05EA</div>\
          <div class="acc-sub">\u05E9\u05D9\u05E4\u05D5\u05E8 \u05D7\u05D5\u05D5\u05D9\u05D9\u05EA \u05E9\u05D9\u05DE\u05D5\u05E9</div>\
        </div>\
        <button class="acc-smallbtn" type="button" data-acc-action="openStatement">\u05D4\u05E6\u05D4\u05E8\u05D4</button>\
      </div>\
      <div class="acc-row">\
        <div>\
          <div class="acc-title">\u05D2\u05D5\u05D3\u05DC \u05D8\u05E7\u05E1\u05D8</div>\
          <div class="acc-sub">\u05D4\u05D2\u05D3\u05DC\u05D4 \u05D4\u05D3\u05E8\u05D2\u05EA\u05D9\u05EA</div>\
        </div>\
        <div class="acc-actions" style="padding:0;">\
          <button class="acc-smallbtn" type="button" data-acc-action="fontDown">-</button>\
          <button class="acc-smallbtn" type="button" data-acc-action="fontUp">+</button>\
        </div>\
      </div>\
      <div class="acc-row">\
        <div>\
          <div class="acc-title">\u05E0\u05D9\u05D2\u05D5\u05D3\u05D9\u05D5\u05EA \u05D2\u05D1\u05D5\u05D4\u05D4</div>\
          <div class="acc-sub">\u05D8\u05E7\u05E1\u05D8 \u05D1\u05E8\u05D5\u05E8 \u05D9\u05D5\u05EA\u05E8</div>\
        </div>\
        <div class="acc-toggle">\
          <input type="checkbox" data-acc-toggle="highContrast" aria-label="High contrast" />\
        </div>\
      </div>\
      <div class="acc-row">\
        <div>\
          <div class="acc-title">\u05D2\u05D5\u05D5\u05E0\u05D9 \u05D0\u05E4\u05D5\u05E8</div>\
          <div class="acc-sub">\u05D4\u05E4\u05D7\u05EA\u05EA \u05E2\u05D5\u05DE\u05E1 \u05E6\u05D1\u05E2</div>\
        </div>\
        <div class="acc-toggle">\
          <input type="checkbox" data-acc-toggle="grayscale" aria-label="Grayscale" />\
        </div>\
      </div>\
      <div class="acc-row">\
        <div>\
          <div class="acc-title">\u05D4\u05D3\u05D2\u05E9\u05EA \u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD</div>\
          <div class="acc-sub">\u05E7\u05D5 \u05EA\u05D7\u05EA\u05D5\u05DF \u05DC\u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD</div>\
        </div>\
        <div class="acc-toggle">\
          <input type="checkbox" data-acc-toggle="underlineLinks" aria-label="Underline links" />\
        </div>\
      </div>\
      <div class="acc-row">\
        <div>\
          <div class="acc-title">\u05D4\u05E4\u05D7\u05EA\u05EA \u05D0\u05E0\u05D9\u05DE\u05E6\u05D9\u05D5\u05EA</div>\
          <div class="acc-sub">\u05EA\u05E0\u05D5\u05E2\u05D4 \u05E4\u05D7\u05D5\u05EA\u05D4</div>\
        </div>\
        <div class="acc-toggle">\
          <input type="checkbox" data-acc-toggle="reduceMotion" aria-label="Reduce motion" />\
        </div>\
      </div>\
      <div class="acc-row">\
        <div>\
          <div class="acc-title">\u05DE\u05E1\u05D2\u05E8\u05EA \u05E4\u05D5\u05E7\u05D5\u05E1</div>\
          <div class="acc-sub">\u05E2\u05D5\u05D6\u05E8 \u05DC\u05E0\u05D9\u05D5\u05D5\u05D8 \u05D1\u05DE\u05E7\u05DC\u05D3\u05EA</div>\
        </div>\
        <div class="acc-toggle">\
          <input type="checkbox" data-acc-toggle="focusRing" aria-label="Focus ring" />\
        </div>\
      </div>\
      <div class="acc-row">\
        <div>\
          <div class="acc-title">\u05E4\u05D5\u05E0\u05D8 \u05E7\u05E8\u05D9\u05D0</div>\
          <div class="acc-sub">\u05DE\u05E6\u05D1 \u05E7\u05E8\u05D9\u05D0\u05D5\u05EA \u05DE\u05D5\u05D2\u05D1\u05E8</div>\
        </div>\
        <div class="acc-toggle">\
          <input type="checkbox" data-acc-toggle="dyslexiaFont" aria-label="Readable font" />\
        </div>\
      </div>\
      <div class="acc-actions">\
        <button class="acc-smallbtn" type="button" data-acc-action="openFeedback">\u05D3\u05D5\u05D5\u05D7 \u05E2\u05DC \u05D1\u05E2\u05D9\u05D4</button>\
        <button class="acc-smallbtn" type="button" data-acc-action="reset">\u05D0\u05D9\u05E4\u05D5\u05E1</button>\
      </div>\
    ';

    var modal = document.createElement("div");
    modal.className = "acc-modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = '\
      <div class="acc-modal-card" role="dialog" aria-modal="true" aria-labelledby="acc-modal-title">\
        <div class="acc-modal-top">\
          <strong id="acc-modal-title">\u05E0\u05D2\u05D9\u05E9\u05D5\u05EA</strong>\
          <button class="acc-close" type="button" aria-label="Close">X</button>\
        </div>\
        <div class="acc-modal-body">\
          <div class="acc-grid">\
            <div class="acc-box" id="acc-statement-box">\
              <h3>\u05D4\u05E6\u05D4\u05E8\u05EA \u05E0\u05D2\u05D9\u05E9\u05D5\u05EA</h3>\
              <small>\u05D8\u05D5\u05E2\u05DF \u05DE\u05D9\u05D3\u05E2...</small>\
            </div>\
            <div class="acc-box">\
              <h3>\u05D8\u05D9\u05E4\u05D9\u05DD \u05DE\u05D4\u05D9\u05E8\u05D9\u05DD</h3>\
              <p style="margin:0 0 8px;">\u05E0\u05D9\u05D5\u05D5\u05D8 \u05D1\u05DE\u05E7\u05DC\u05D3\u05EA: Tab \u05D5-Shift+Tab</p>\
              <p style="margin:0 0 8px;">\u05D4\u05D2\u05D3\u05DC\u05EA \u05D8\u05E7\u05E1\u05D8: + / - \u05D1\u05D7\u05DC\u05D5\u05E0\u05D9\u05EA</p>\
              <p style="margin:0;">\u05D0\u05DD \u05DE\u05E9\u05D4\u05D5 \u05DC\u05D0 \u05E2\u05D5\u05D1\u05D3, \u05D3\u05D5\u05D5\u05D7\u05D5 \u05DC\u05E0\u05D5 \u05D5\u05E0\u05E4\u05EA\u05D5\u05E8.</p>\
            </div>\
          </div>\
          <div class="acc-box" style="margin-top:12px; display:none;" id="acc-feedback-box">\
            <h3>\u05D3\u05D9\u05D5\u05D5\u05D7 \u05E2\u05DC \u05D1\u05E2\u05D9\u05D9\u05EA \u05E0\u05D2\u05D9\u05E9\u05D5\u05EA</h3>\
            <form class="acc-form" id="acc-feedback-form">\
              <label for="acc-email">\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)</label>\
              <input id="acc-email" name="email" type="email" autocomplete="email" />\
              <label for="acc-msg">\u05EA\u05D9\u05D0\u05D5\u05E8 \u05D4\u05D1\u05E2\u05D9\u05D4</label>\
              <textarea id="acc-msg" name="message" required minlength="5" maxlength="4000"></textarea>\
              <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">\
                <button class="acc-smallbtn" type="submit">\u05E9\u05DC\u05D9\u05D7\u05D4</button>\
                <button class="acc-smallbtn" type="button" data-acc-action="closeModal">\u05E1\u05D2\u05D9\u05E8\u05D4</button>\
              </div>\
              <div class="acc-alert" id="acc-feedback-alert" aria-live="polite"></div>\
            </form>\
          </div>\
        </div>\
      </div>\
    ';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    document.body.appendChild(modal);

    $$('input[data-acc-toggle]', panel).forEach(function(el) {
      var k = el.getAttribute("data-acc-toggle");
      el.checked = !!state[k];
      el.addEventListener("change", function() {
        state[k] = el.checked;
        saveState(state);
        applyState(state);
        audit("ACCESSIBILITY_TOGGLE", k, { enabled: el.checked });
      });
    });

    btn.addEventListener("click", function() {
      var open = panel.getAttribute("aria-hidden") === "true";
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) {
        audit("ACCESSIBILITY_PANEL_OPEN", "panel", {});
        focusFirstFocusable(panel);
      } else {
        audit("ACCESSIBILITY_PANEL_CLOSE", "panel", {});
        btn.focus();
      }
    });

    panel.addEventListener("click", function(e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var action = t.getAttribute("data-acc-action");
      if (!action) return;

      if (action === "fontUp") {
        state.fontScale = Math.min(1.3, Math.round((state.fontScale + 0.1) * 10) / 10);
        saveState(state);
        applyState(state);
        audit("ACCESSIBILITY_FONT", "fontScale", { value: state.fontScale });
      }

      if (action === "fontDown") {
        state.fontScale = Math.max(1.0, Math.round((state.fontScale - 0.1) * 10) / 10);
        saveState(state);
        applyState(state);
        audit("ACCESSIBILITY_FONT", "fontScale", { value: state.fontScale });
      }

      if (action === "reset") {
        Object.assign(state, defaultState);
        saveState(state);
        applyState(state);
        $$('input[data-acc-toggle]', panel).forEach(function(el) {
          var k = el.getAttribute("data-acc-toggle");
          el.checked = !!state[k];
        });
        audit("ACCESSIBILITY_RESET", "panel", {});
      }

      if (action === "openStatement") {
        openModal(modal, "statement");
      }

      if (action === "openFeedback") {
        openModal(modal, "feedback");
      }
    });

    var closeBtn = $(".acc-close", modal);
    var closeModalBtn = $('[data-acc-action="closeModal"]', modal);
    var modalCard = $(".acc-modal-card", modal);
    var untrap = null;
    var lastFocus = null;

    function closeModal() {
      modal.setAttribute("aria-hidden", "true");
      if (untrap) untrap();
      untrap = null;
      if (lastFocus) lastFocus.focus();
    }

    closeBtn.addEventListener("click", closeModal);
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", function(e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", function(e) {
      if (modal.getAttribute("aria-hidden") === "false" && e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    });

    function openModal(modalEl, mode) {
      lastFocus = document.activeElement;
      modalEl.setAttribute("aria-hidden", "false");

      var feedbackBox = $("#acc-feedback-box", modalEl);
      var statementBox = $("#acc-statement-box", modalEl);
      if (mode === "feedback") {
        feedbackBox.style.display = "block";
        renderStatement(statementBox, false);
        audit("ACCESSIBILITY_MODAL_OPEN", "feedback", {});
      } else {
        feedbackBox.style.display = "none";
        renderStatement(statementBox, true);
        audit("ACCESSIBILITY_MODAL_OPEN", "statement", {});
      }

      untrap = trapFocus(modalCard);
      focusFirstFocusable(modalCard);
    }

    var form = $("#acc-feedback-form", modal);
    var alertEl = $("#acc-feedback-alert", modal);

    form.addEventListener("submit", function(e) {
      e.preventDefault();
      alertEl.textContent = "";

      var email = String($("#acc-email", modal).value || "").trim();
      var message = String($("#acc-msg", modal).value || "").trim();

      if (message.length < 5) {
        alertEl.setAttribute("role", "alert");
        alertEl.textContent = "\u05E0\u05D0 \u05DC\u05DB\u05EA\u05D5\u05D1 \u05DC\u05E4\u05D7\u05D5\u05EA 5 \u05EA\u05D5\u05D5\u05D9\u05DD.";
        return;
      }

      fetch(CFG.apiFeedback, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || "",
          message: message,
          pageUrl: location.href
        })
      })
      .then(function(resp) {
        return resp.json().then(function(data) {
          if (!resp.ok) {
            alertEl.setAttribute("role", "alert");
            alertEl.textContent = data && data.error ? "\u05E9\u05D2\u05D9\u05D0\u05D4: " + data.error : "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DC\u05D9\u05D7\u05D4.";
            return;
          }
          alertEl.setAttribute("role", "status");
          alertEl.textContent = "\u05E0\u05E9\u05DC\u05D7 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4. \u05EA\u05D5\u05D3\u05D4.";
          $("#acc-msg", modal).value = "";
          audit("ACCESSIBILITY_FEEDBACK_SENT", "feedback", { hasEmail: !!email });
        });
      })
      .catch(function() {
        alertEl.setAttribute("role", "alert");
        alertEl.textContent = "\u05E9\u05D2\u05D9\u05D0\u05EA \u05E8\u05E9\u05EA. \u05E0\u05E1\u05D5 \u05E9\u05D5\u05D1.";
      });
    });

    function renderStatement(box, showContact) {
      box.innerHTML = '<h3>\u05D4\u05E6\u05D4\u05E8\u05EA \u05E0\u05D2\u05D9\u05E9\u05D5\u05EA</h3><small>\u05D8\u05D5\u05E2\u05DF \u05DE\u05D9\u05D3\u05E2...</small>';
      fetch(CFG.apiStatement, { method: "GET" })
      .then(function(resp) { return resp.json(); })
      .then(function(st) {
        var contact = st.contact || {};
        var lines = [
          "\u05E8\u05DE\u05EA \u05EA\u05D0\u05D9\u05DE\u05D5\u05EA: " + (st.complianceLevel || "WCAG 2.1 AA"),
          "\u05EA\u05E7\u05DF: " + (st.standardIsrael || "5568"),
          "\u05EA\u05D0\u05E8\u05D9\u05DA \u05D1\u05D3\u05D9\u05E7\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4: " + (st.lastAuditDate || "N/A"),
        ];

        var limitations = Array.isArray(st.knownLimitations) ? st.knownLimitations : [];
        var limHtml = limitations.length
          ? '<ul>' + limitations.map(function(x) { return '<li>' + escapeHtml(String(x)) + '</li>'; }).join('') + '</ul>'
          : '<p style="margin:0;">\u05D0\u05D9\u05DF \u05DE\u05D2\u05D1\u05DC\u05D5\u05EA \u05D9\u05D3\u05D5\u05E2\u05D5\u05EA.</p>';

        var contactHtml = showContact
          ? '<div style="margin-top:10px;">' +
              '<h3 style="margin:0 0 6px; font-size:13px;">\u05D0\u05D9\u05E9 \u05E7\u05E9\u05E8</h3>' +
              '<p style="margin:0;">' + escapeHtml(contact.title || "\u05E8\u05DB\u05D6 \u05E0\u05D2\u05D9\u05E9\u05D5\u05EA") + '</p>' +
              '<p style="margin:0;">\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC: ' + escapeHtml(contact.email || "accessibility@example.com") + '</p>' +
              '<p style="margin:0;">\u05D8\u05DC\u05E4\u05D5\u05DF: ' + escapeHtml(contact.phone || "+972...") + '</p>' +
              '<p style="margin:0;">\u05D6\u05DE\u05DF \u05EA\u05D2\u05D5\u05D1\u05D4: ' + escapeHtml(contact.responseTime || "N/A") + '</p>' +
            '</div>'
          : '';

        box.innerHTML =
          '<h3>\u05D4\u05E6\u05D4\u05E8\u05EA \u05E0\u05D2\u05D9\u05E9\u05D5\u05EA</h3>' +
          '<p style="margin:0 0 10px;">' + lines.map(function(l) { return escapeHtml(l); }).join('<br/>') + '</p>' +
          '<div class="acc-box" style="padding:10px; margin:0;">' +
            '<h3 style="margin:0 0 6px; font-size:13px;">\u05DE\u05D2\u05D1\u05DC\u05D5\u05EA \u05D9\u05D3\u05D5\u05E2\u05D5\u05EA</h3>' +
            limHtml +
          '</div>' +
          contactHtml;
      })
      .catch(function() {
        box.innerHTML = '<h3>\u05D4\u05E6\u05D4\u05E8\u05EA \u05E0\u05D2\u05D9\u05E9\u05D5\u05EA</h3><p style="margin:0;">\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF \u05DE\u05D9\u05D3\u05E2 \u05DB\u05E8\u05D2\u05E2.</p>';
      });
    }

    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, function(c) {
        var m = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return m[c] || c;
      });
    }
  }

  function init() {
    injectStyles();
    var state = loadState();

    if (prefersReducedMotion() && !localStorage.getItem(KEY)) {
      state.reduceMotion = true;
      saveState(state);
    }

    applyState(state);
    buildUI(state);
    audit("ACCESSIBILITY_INIT", "widget", { version: "2026" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
