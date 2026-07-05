/* storage.js — shared state, localStorage persistence, and file downloads.
   Exposes a single global `RapidClaim` object used by app.js and survey.js. */
(function (window) {
  "use strict";

  var STORAGE_KEY = "rapidclaim.session";
  var SUBMISSIONS_KEY = "rapidclaim.submissions";

  // The single data model for one tester's run-through.
  function emptyState() {
    return {
      timestamp: new Date().toISOString(),
      claim: { name: "", claimType: "", estimatedLoss: null },
      decision: { outcome: "", payout: null, reference: "", accepted: null, path: "" },
      payment: { accountName: "", routingNumber: "", accountNumber: "" },
      survey: {
        name: "", age: null, postcode: "", education: "", gender: "",
        madeClaimBefore: "", understandSolution: "", desiredOutcome: "", comments: ""
      }
    };
  }

  var state = load() || emptyState();

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* localStorage may be unavailable (private mode) — fail silently for a prototype */
    }
  }

  function reset() {
    state = emptyState();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  // --- Completed submissions (for the designer view pages) ---
  // Each finished run is appended to an array so results accumulate on this
  // browser. (No backend: this only collects runs done in THIS browser.)

  function getSubmissions() {
    try {
      var raw = window.localStorage.getItem(SUBMISSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // Append a deep copy of the current session as a finished submission.
  function commitSubmission() {
    try {
      var list = getSubmissions();
      var record = JSON.parse(JSON.stringify(state));
      record.submittedAt = new Date().toISOString();
      list.push(record);
      window.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  }

  function clearSubmissions() {
    try {
      window.localStorage.removeItem(SUBMISSIONS_KEY);
    } catch (e) { /* ignore */ }
  }

  // --- Download helpers ---

  function triggerDownload(blob, filename) {
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  function stamp() {
    // e.g. 2026-07-05T14-30-00 — filesystem-safe
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  function downloadJSON() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    triggerDownload(blob, "rapidclaim-response-" + stamp() + ".json");
  }

  function csvCell(value) {
    var s = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function downloadCSV() {
    var rows = [
      ["field", "value"],
      ["timestamp", state.timestamp],
      ["name", state.claim.name],
      ["claim_type", state.claim.claimType],
      ["estimated_loss", state.claim.estimatedLoss],
      ["decision_outcome", state.decision.outcome],
      ["payout", state.decision.payout],
      ["reference", state.decision.reference],
      ["offer_accepted", state.decision.accepted],
      ["chosen_path", state.decision.path],
      ["payment_account_name", state.payment.accountName],
      ["payment_routing_number", state.payment.routingNumber],
      ["payment_account_number", state.payment.accountNumber],
      ["survey_name", state.survey.name],
      ["survey_age", state.survey.age],
      ["survey_postcode", state.survey.postcode],
      ["survey_education", state.survey.education],
      ["survey_gender", state.survey.gender],
      ["survey_made_claim_before", state.survey.madeClaimBefore],
      ["survey_understand_solution", state.survey.understandSolution],
      ["survey_desired_outcome", state.survey.desiredOutcome],
      ["survey_comments", state.survey.comments]
    ];
    var csv = rows.map(function (r) {
      return r.map(csvCell).join(",");
    }).join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    triggerDownload(blob, "rapidclaim-response-" + stamp() + ".csv");
  }

  window.RapidClaim = {
    STORAGE_KEY: STORAGE_KEY,
    SUBMISSIONS_KEY: SUBMISSIONS_KEY,
    get state() { return state; },
    save: save,
    reset: reset,
    getSubmissions: getSubmissions,
    commitSubmission: commitSubmission,
    clearSubmissions: clearSubmissions,
    downloadJSON: downloadJSON,
    downloadCSV: downloadCSV
  };
})(window);
