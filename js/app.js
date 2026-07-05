/* app.js — section navigation, claim form validation, and mock assessment. */
(function (window, document) {
  "use strict";

  var RC = window.RapidClaim;
  var STEP_ORDER = ["intro", "claim", "outcome", "survey"];

  // ---------- Navigation ----------
  function ensureProgress() {
    if (!RC.state.progress) {
      RC.state.progress = { intro: true, claim: false, outcome: false, survey: false };
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
      if (s.claim.name) form.querySelector('[name="name"]').value = s.claim.name;
      if (s.claim.causeOfDamage) form.causeOfDamage.value = s.claim.causeOfDamage;
      if (s.claim.dateOfDamage) form.dateOfDamage.value = s.claim.dateOfDamage;
      if (s.claim.timeOfDamage) form.timeOfDamage.value = s.claim.timeOfDamage;
      (s.claim.damagedAreas || []).forEach(function (v) { setChecked("damagedAreas", v); });
      if (s.claim.damageExtent) form.damageExtent.value = s.claim.damageExtent;
      if (s.claim.safeLiveable) setChecked("safeLiveable", s.claim.safeLiveable);
      (s.claim.safetyIssues || []).forEach(function (v) { setChecked("safetyIssues", v); });
      if (s.claim.estimatedLoss !== null && s.claim.estimatedLoss !== undefined && s.claim.estimatedLoss !== "") {
        form.estimatedLoss.value = s.claim.estimatedLoss;
      }
      updatePhotoStatus();
    }
    if (paymentForm) {
      if (s.payment.accountName) paymentForm.accountName.value = s.payment.accountName;
      if (s.payment.bsb) paymentForm.bsb.value = s.payment.bsb;
      if (s.payment.accountNumber) paymentForm.accountNumber.value = s.payment.accountNumber;
    }
    // Restore a previously computed assessment so the outcome page isn't blank
    // when revisited via the navigator or after a reload.
    if (s.decision && s.decision.outcome) {
      displayDecision(s.decision);
      if (decisionEl) decisionEl.hidden = false;
    }
  }

  // ---------- Validation helpers ----------
  function setError(name, message) {
    var msg = document.querySelector('.error[data-for="' + name + '"]');
    var input = document.querySelector('[name="' + name + '"]');
    if (msg) msg.textContent = message || "";
    if (input) input.classList.toggle("invalid", !!message);
  }

  // Values of all ticked checkboxes in a named group.
  function checkedValues(name) {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="' + name + '"]:checked'))
      .map(function (c) { return c.value; });
  }

  // Value of the selected radio in a named group (or "").
  function selectedRadio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  // Tick a checkbox/radio by its group name and value (used when rehydrating).
  function setChecked(name, value) {
    var el = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
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

    var name = form.querySelector('[name="name"]').value.trim();
    var cause = form.causeOfDamage.value;
    var dateOfDamage = form.dateOfDamage.value;
    var timeOfDamage = form.timeOfDamage.value;
    var damagedAreas = checkedValues("damagedAreas");
    var damageExtent = form.damageExtent.value;
    var safeLiveable = selectedRadio("safeLiveable");
    var safetyIssues = checkedValues("safetyIssues");
    var lossRaw = form.estimatedLoss.value;
    var loss = parseFloat(lossRaw);

    var ok = true;
    if (!name) { setError("name", "Please enter your name."); ok = false; }
    else setError("name", "");

    if (!cause) { setError("causeOfDamage", "Please choose what caused the damage."); ok = false; }
    else setError("causeOfDamage", "");

    if (!dateOfDamage) { setError("dateOfDamage", "Please enter the date it happened."); ok = false; }
    else setError("dateOfDamage", "");

    if (!damagedAreas.length) { setError("damagedAreas", "Please select at least one area."); ok = false; }
    else setError("damagedAreas", "");

    if (!damageExtent) { setError("damageExtent", "Please choose the rough extent."); ok = false; }
    else setError("damageExtent", "");

    if (!safeLiveable) { setError("safeLiveable", "Please let us know if it's safe and liveable."); ok = false; }
    else setError("safeLiveable", "");

    if (lossRaw === "" || isNaN(loss) || loss < 0) {
      setError("estimatedLoss", "Please enter an estimated amount (0 or more).");
      ok = false;
    } else setError("estimatedLoss", "");

    if (!ok) return;

    // Save claim inputs.
    RC.state.claim.name = name;
    RC.state.claim.causeOfDamage = cause;
    RC.state.claim.dateOfDamage = dateOfDamage;
    RC.state.claim.timeOfDamage = timeOfDamage;
    RC.state.claim.damagedAreas = damagedAreas;
    RC.state.claim.damageExtent = damageExtent;
    RC.state.claim.safeLiveable = safeLiveable;
    RC.state.claim.safetyIssues = safetyIssues;
    RC.state.claim.estimatedLoss = loss;
    RC.state.timestamp = new Date().toISOString();
    RC.save();

    // Move to the assessment outcome page and simulate processing there.
    decisionEl.hidden = true;
    paymentEl.hidden = true;
    fullclaimEl.hidden = true;
    assessingEl.hidden = false;
    showStep("outcome");

    window.setTimeout(function () {
      assessingEl.hidden = true;
      renderDecision(assess(loss));
    }, 1800);
  });

  // ---------- Photos / videos (Q4) ----------
  // No backend, so we can't persist the files themselves — record the file
  // names/count and show what's been added.
  var photoInput = document.getElementById("claim-photos");
  var photoStatus = document.getElementById("photo-status");

  function updatePhotoStatus() {
    var names = RC.state.claim.photoNames || [];
    if (!photoStatus) return;
    photoStatus.textContent = names.length
      ? names.length + (names.length === 1 ? " file added: " : " files added: ") + names.join(", ")
      : "";
  }

  if (photoInput) {
    photoInput.addEventListener("change", function () {
      var names = Array.prototype.slice.call(photoInput.files).map(function (f) { return f.name; });
      RC.state.claim.photoNames = names;
      RC.state.claim.photoCount = names.length;
      RC.save();
      updatePhotoStatus();
    });
  }

  // Paint the decision panel from a saved/just-computed decision object.
  function displayDecision(d) {
    var badge = document.getElementById("decision-badge");
    badge.className = "decision-badge " + (d.badgeClass || "");
    badge.textContent = d.outcome && d.outcome.indexOf("Referred") === 0 ? "!" : "✓";
    document.getElementById("decision-title").textContent = d.title || "";
    document.getElementById("decision-message").textContent = d.message || "";
    document.getElementById("payout-amount").textContent = formatUSD(d.payout);
    document.getElementById("claim-ref").textContent = d.reference || "";
  }

  function renderDecision(result) {
    RC.state.decision.outcome = result.outcome;
    RC.state.decision.title = result.title;
    RC.state.decision.message = result.message;
    RC.state.decision.badgeClass = result.badgeClass;
    RC.state.decision.payout = result.payout;
    RC.state.decision.reference = result.reference;
    RC.state.decision.accepted = null;
    RC.save();

    displayDecision(RC.state.decision);
    decisionEl.hidden = false;
  }

  var paymentEl = document.getElementById("payment");
  var paidEl = document.getElementById("paid");
  var fullclaimEl = document.getElementById("fullclaim");
  var paymentForm = document.getElementById("payment-form");

  // Back from the offer to the claim details page (to review/edit).
  document.getElementById("decision-back").addEventListener("click", function () {
    showStep("claim");
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

  // Confirm bank details, then show the payment-confirmed screen.
  paymentForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var accountName = paymentForm.accountName.value.trim();
    var bsb = paymentForm.bsb.value.trim();
    var account = paymentForm.accountNumber.value.trim();

    var ok = true;
    if (!accountName) { setError("accountName", "Please enter the account holder's name."); ok = false; }
    else setError("accountName", "");
    if (!bsb) { setError("bsb", "Please enter a BSB number."); ok = false; }
    else setError("bsb", "");
    if (!account) { setError("accountNumber", "Please enter an account number."); ok = false; }
    else setError("accountNumber", "");
    if (!ok) return;

    RC.state.payment.accountName = accountName;
    RC.state.payment.bsb = bsb;
    RC.state.payment.accountNumber = account;
    RC.save();

    document.getElementById("paid-amount").textContent = formatUSD(RC.state.decision.payout);
    document.getElementById("paid-ref").textContent = RC.state.decision.reference;
    paymentEl.hidden = true;
    paidEl.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    paidEl.hidden = true;
    fullclaimEl.hidden = true;
    setError("name", "");
    setError("causeOfDamage", "");
    setError("dateOfDamage", "");
    setError("damagedAreas", "");
    setError("damageExtent", "");
    setError("safeLiveable", "");
    setError("estimatedLoss", "");
    setError("accountName", "");
    setError("bsb", "");
    setError("accountNumber", "");
    updatePhotoStatus();
  };

  // ---------- Init ----------
  // Restore any cached entries and render the nav for the opening step.
  hydrate();
  renderNav("intro");
})(window, document);
