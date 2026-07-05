/* app.js — section navigation, claim form validation, and mock assessment. */
(function (window, document) {
  "use strict";

  var RC = window.RapidClaim;
  var STEP_ORDER = ["intro", "claim", "survey"];

  // ---------- Navigation ----------
  function showStep(id) {
    document.querySelectorAll(".step").forEach(function (s) {
      s.classList.toggle("active", s.id === id);
    });

    var currentIndex = STEP_ORDER.indexOf(id);
    document.querySelectorAll(".progress li").forEach(function (li) {
      var idx = STEP_ORDER.indexOf(li.dataset.step);
      li.classList.toggle("active", idx === currentIndex);
      li.classList.toggle("done", idx < currentIndex);
    });

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
})(window, document);
