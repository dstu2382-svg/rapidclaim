/* app.js — section navigation, claim form validation, and mock assessment. */
(function (window, document) {
  "use strict";

  var RC = window.RapidClaim;
  var STEP_ORDER = ["intro", "claim", "survey"];

  // ---------- Navigation ----------
  function ensureProgress() {
    if (!RC.state.progress) {
      RC.state.progress = { intro: true, claim: false, survey: false };
    }
    return RC.state.progress;
  }

  function isUnlocked(step) {
    return !!ensureProgress()[step];
  }

  // A step is "unlocked" once the tester reaches it by completing the previous
  // step's action. Unlocked steps stay reachable via the top-left nav links.
  function unlock(step) {
    var p = ensureProgress();
    if (!p[step]) {
      p[step] = true;
      RC.save();
    }
  }

  // Reflect the current step + which steps are clickable in the progress nav.
  function renderNav(activeId) {
    var currentIndex = STEP_ORDER.indexOf(activeId);
    document.querySelectorAll(".progress li").forEach(function (li) {
      var step = li.dataset.step;
      var idx = STEP_ORDER.indexOf(step);
      var enabled = isUnlocked(step) && idx !== currentIndex;
      li.classList.toggle("active", idx === currentIndex);
      li.classList.toggle("done", idx < currentIndex);
      li.classList.toggle("nav-enabled", enabled);
      if (enabled) {
        li.setAttribute("role", "link");
        li.setAttribute("tabindex", "0");
      } else {
        li.removeAttribute("role");
        li.removeAttribute("tabindex");
      }
    });
  }

  function showStep(id) {
    unlock(id);
    document.querySelectorAll(".step").forEach(function (s) {
      s.classList.toggle("active", s.id === id);
    });
    renderNav(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Expose so survey.js (and restart) can navigate too.
  RC.showStep = showStep;

  // Any element with data-goto navigates when clicked.
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-goto]");
    if (trigger) {
      e.preventDefault();
      showStep(trigger.dataset.goto);
    }
  });

  // Top-left progress pills act as links to any already-unlocked step.
  var progressEl = document.querySelector(".progress");
  if (progressEl) {
    progressEl.addEventListener("click", function (e) {
      var li = e.target.closest("li[data-step]");
      if (li && li.classList.contains("nav-enabled")) {
        showStep(li.dataset.step);
      }
    });
    progressEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var li = e.target.closest("li[data-step]");
      if (li && li.classList.contains("nav-enabled")) {
        e.preventDefault();
        showStep(li.dataset.step);
      }
    });
  }

  // ---------- Restore cached details ----------
  // The session is already persisted to localStorage; re-fill the claim and
  // payment fields so nothing is lost when navigating back or reloading.
  function hydrate() {
    var s = RC.state;
    if (form) {
      if (s.claim.name) form.name.value = s.claim.name;
      if (s.claim.claimType) form.claimType.value = s.claim.claimType;
      if (s.claim.estimatedLoss !== null && s.claim.estimatedLoss !== undefined && s.claim.estimatedLoss !== "") {
        form.estimatedLoss.value = s.claim.estimatedLoss;
      }
    }
    if (paymentForm) {
      if (s.payment.accountName) paymentForm.accountName.value = s.payment.accountName;
      if (s.payment.routingNumber) paymentForm.routingNumber.value = s.payment.routingNumber;
      if (s.payment.accountNumber) paymentForm.accountNumber.value = s.payment.accountNumber;
    }
  }

  // ---------- Validation helpers ----------
  function setError(name, message) {
    var msg = document.querySelector('.error[data-for="' + name + '"]');
    var input = document.querySelector('[name="' + name + '"]');
    if (msg) msg.textContent = message || "";
    if (input) input.classList.toggle("invalid", !!message);
  }

  // ---------- Mock assessment ----------
  function makeReference() {
    var n = Math.floor(100000 + Math.random() * 900000);
    return "RC-" + n;
  }

  function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  // Produce a plausible-looking (but entirely simulated) decision.
  function assess(estimatedLoss) {
    var outcomes = [
      { key: "Approved", title: "Claim approved", badge: "badge-approved",
        message: "Good news — your claim has been approved in full.", factor: [0.85, 1.0] },
      { key: "Approved (partial)", title: "Partially approved", badge: "badge-partial",
        message: "Your claim has been approved, with a partial payout after policy excess.", factor: [0.4, 0.75] },
      { key: "Referred", title: "Referred for review", badge: "badge-referred",
        message: "Your claim needs a quick manual review. Here's our provisional offer.", factor: [0.3, 0.6] }
    ];
    // Weight approvals higher so the demo usually feels positive.
    var pick = Math.random();
    var outcome = pick < 0.6 ? outcomes[0] : (pick < 0.85 ? outcomes[1] : outcomes[2]);

    var base = estimatedLoss > 0 ? estimatedLoss : randInt(500, 5000);
    var factor = outcome.factor[0] + Math.random() * (outcome.factor[1] - outcome.factor[0]);
    var payout = Math.max(50, Math.round((base * factor) / 10) * 10); // round to nearest £10

    return {
      outcome: outcome.key,
      title: outcome.title,
      badgeClass: outcome.badge,
      message: outcome.message,
      payout: payout,
      reference: makeReference()
    };
  }

  function formatUSD(amount) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD", maximumFractionDigits: 0
      }).format(amount);
    } catch (e) {
      return "$" + amount;
    }
  }

  // ---------- Claim form ----------
  var form = document.getElementById("claim-form");
  var assessingEl = document.getElementById("assessing");
  var decisionEl = document.getElementById("decision");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name = form.name.value.trim();
    var claimType = form.claimType.value;
    var lossRaw = form.estimatedLoss.value;
    var loss = parseFloat(lossRaw);

    var ok = true;
    if (!name) { setError("name", "Please enter your name."); ok = false; }
    else setError("name", "");

    if (!claimType) { setError("claimType", "Please choose a claim type."); ok = false; }
    else setError("claimType", "");

    if (lossRaw === "" || isNaN(loss) || loss < 0) {
      setError("estimatedLoss", "Please enter an estimated amount (0 or more).");
      ok = false;
    } else setError("estimatedLoss", "");

    if (!ok) return;

    // Save claim inputs.
    RC.state.claim.name = name;
    RC.state.claim.claimType = claimType;
    RC.state.claim.estimatedLoss = loss;
    RC.state.timestamp = new Date().toISOString();
    RC.save();

    // Simulate processing, then reveal the decision.
    form.hidden = true;
    decisionEl.hidden = true;
    assessingEl.hidden = false;

    window.setTimeout(function () {
      assessingEl.hidden = true;
      renderDecision(assess(loss));
    }, 1800);
  });

  function renderDecision(result) {
    RC.state.decision.outcome = result.outcome;
    RC.state.decision.payout = result.payout;
    RC.state.decision.reference = result.reference;
    RC.state.decision.accepted = null;
    RC.save();

    var badge = document.getElementById("decision-badge");
    badge.className = "decision-badge " + result.badgeClass;
    badge.textContent = result.outcome.indexOf("Referred") === 0 ? "!" : "✓";

    document.getElementById("decision-title").textContent = result.title;
    document.getElementById("decision-message").textContent = result.message;
    document.getElementById("payout-amount").textContent = formatUSD(result.payout);
    document.getElementById("claim-ref").textContent = result.reference;

    decisionEl.hidden = false;
  }

  var paymentEl = document.getElementById("payment");
  var fullclaimEl = document.getElementById("fullclaim");
  var paymentForm = document.getElementById("payment-form");

  // Back from the offer to the claim form (to review/edit the details).
  document.getElementById("decision-back").addEventListener("click", function () {
    decisionEl.hidden = true;
    form.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Accept the payout -> collect bank details.
  document.getElementById("accept-btn").addEventListener("click", function () {
    RC.state.decision.path = "payout";
    RC.state.decision.accepted = true;
    RC.save();
    document.getElementById("payment-amount").textContent = formatUSD(RC.state.decision.payout);
    decisionEl.hidden = true;
    paymentEl.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Back from bank details to the offer.
  document.getElementById("payment-back").addEventListener("click", function () {
    paymentEl.hidden = true;
    decisionEl.hidden = false;
  });

  // Confirm bank details, then continue to the survey.
  paymentForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var accountName = paymentForm.accountName.value.trim();
    var routing = paymentForm.routingNumber.value.trim();
    var account = paymentForm.accountNumber.value.trim();

    var ok = true;
    if (!accountName) { setError("accountName", "Please enter the account holder's name."); ok = false; }
    else setError("accountName", "");
    if (!routing) { setError("routingNumber", "Please enter a routing number."); ok = false; }
    else setError("routingNumber", "");
    if (!account) { setError("accountNumber", "Please enter an account number."); ok = false; }
    else setError("accountNumber", "");
    if (!ok) return;

    RC.state.payment.accountName = accountName;
    RC.state.payment.routingNumber = routing;
    RC.state.payment.accountNumber = account;
    RC.save();
    showStep("survey");
  });

  // Proceed to a full claim instead of taking the payout.
  document.getElementById("fullclaim-btn").addEventListener("click", function () {
    RC.state.decision.path = "full_claim";
    RC.state.decision.accepted = false;
    RC.save();
    document.getElementById("fullclaim-ref").textContent = RC.state.decision.reference;
    decisionEl.hidden = true;
    fullclaimEl.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Back from the full-claim acknowledgement to the offer.
  document.getElementById("fullclaim-back").addEventListener("click", function () {
    fullclaimEl.hidden = true;
    decisionEl.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- Reset the claim section UI (used by "Start over") ----------
  RC.resetClaimUI = function () {
    form.reset();
    paymentForm.reset();
    form.hidden = false;
    assessingEl.hidden = true;
    decisionEl.hidden = true;
    paymentEl.hidden = true;
    fullclaimEl.hidden = true;
    setError("name", "");
    setError("claimType", "");
    setError("estimatedLoss", "");
    setError("accountName", "");
    setError("routingNumber", "");
    setError("accountNumber", "");
  };

  // ---------- Init ----------
  // Restore any cached entries and render the nav for the opening step.
  hydrate();
  renderNav("intro");
})(window, document);
