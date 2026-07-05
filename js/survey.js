/* survey.js — survey validation, saving, thank-you screen, downloads, and restart. */
(function (window, document) {
  "use strict";

  var RC = window.RapidClaim;
  var form = document.getElementById("survey-form");
  var thanksEl = document.getElementById("thanks");

  // Text/number/select fields that must be filled in.
  var INPUTS = ["name", "age", "postcode", "education", "gender"];
  // Radio-button question groups that must have a selection.
  var CHOICES = ["madeClaimBefore", "understandSolution", "desiredOutcome"];

  function setError(name, message) {
    var msg = document.querySelector('.error[data-for="' + name + '"]');
    var input = form.querySelector('[name="' + name + '"]');
    if (msg) msg.textContent = message || "";
    if (input && input.tagName !== undefined && input.type !== "radio") {
      input.classList.toggle("invalid", !!message);
    }
  }

  function selectedChoice(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var ok = true;
    var firstBad = null;

    INPUTS.forEach(function (name) {
      var value = (form[name].value || "").trim();
      if (!value) {
        setError(name, "Please complete this field.");
        ok = false;
        if (!firstBad) firstBad = form[name];
      } else {
        setError(name, "");
        RC.state.survey[name] = value;
      }
    });

    CHOICES.forEach(function (name) {
      var value = selectedChoice(name);
      if (value === null) {
        setError(name, "Please choose an answer.");
        ok = false;
        if (!firstBad) firstBad = form.querySelector('input[name="' + name + '"]');
      } else {
        setError(name, "");
        RC.state.survey[name] = value;
      }
    });

    if (!ok) {
      if (firstBad) firstBad.focus();
      return;
    }

    RC.state.survey.comments = form.comments.value.trim();
    RC.save();
    RC.commitSubmission();  // append this finished run for the designer view pages

    form.hidden = true;
    thanksEl.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Downloads.
  document.getElementById("download-json").addEventListener("click", RC.downloadJSON);
  document.getElementById("download-csv").addEventListener("click", RC.downloadCSV);

  // Start over — clear state and return a fresh tester to the intro.
  document.getElementById("restart-btn").addEventListener("click", function () {
    RC.reset();
    form.reset();
    INPUTS.concat(CHOICES).forEach(function (n) { setError(n, ""); });
    form.hidden = false;
    thanksEl.hidden = true;
    RC.resetClaimUI();
    RC.showStep("intro");
  });
})(window, document);
