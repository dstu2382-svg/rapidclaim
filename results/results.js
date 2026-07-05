/* results.js — renders accumulated submissions for the two designer view pages.
   Reads from RapidClaim.getSubmissions() (localStorage). Which view to render is
   set via <body data-view="claims|survey">. */
(function (window, document) {
  "use strict";

  var RC = window.RapidClaim;
  var view = document.body.dataset.view;         // "claims" | "survey"
  var root = document.getElementById("results-root");
  var countEl = document.getElementById("results-count");

  function usd(n) {
    if (n === null || n === undefined || n === "") return "";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD", maximumFractionDigits: 0
      }).format(n);
    } catch (e) { return "$" + n; }
  }

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function when(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
  }

  function yesNo(v) {
    if (v === true) return "Yes";
    if (v === false) return "No";
    return v || "";
  }

  // Column definitions per view: [header, accessor(record)].
  var COLUMNS = {
    claims: [
      ["Submitted", function (r) { return when(r.submittedAt); }],
      ["Name", function (r) { return r.claim.name; }],
      ["Claim type", function (r) { return r.claim.claimType; }],
      ["Est. loss", function (r) { return usd(r.claim.estimatedLoss); }],
      ["Outcome", function (r) { return r.decision.outcome; }],
      ["Payout", function (r) { return usd(r.decision.payout); }],
      ["Reference", function (r) { return r.decision.reference; }],
      ["Path", function (r) { return r.decision.path === "full_claim" ? "Full claim" : (r.decision.path === "payout" ? "Payout" : ""); }],
      ["Accepted", function (r) { return yesNo(r.decision.accepted); }],
      ["Acct name", function (r) { return r.payment ? r.payment.accountName : ""; }],
      ["Routing", function (r) { return r.payment ? r.payment.routingNumber : ""; }],
      ["Account", function (r) { return r.payment ? r.payment.accountNumber : ""; }]
    ],
    survey: [
      ["Submitted", function (r) { return when(r.submittedAt); }],
      ["Name", function (r) { return r.survey.name; }],
      ["Age", function (r) { return r.survey.age; }],
      ["Postcode", function (r) { return r.survey.postcode; }],
      ["Education", function (r) { return r.survey.education; }],
      ["Gender", function (r) { return r.survey.gender; }],
      ["Claimed before?", function (r) { return r.survey.madeClaimBefore; }],
      ["Understands?", function (r) { return r.survey.understandSolution; }],
      ["Desired outcome", function (r) { return r.survey.desiredOutcome; }],
      ["Comments", function (r) { return r.survey.comments; }]
    ]
  };

  function render() {
    var records = RC.getSubmissions();
    var cols = COLUMNS[view];

    countEl.textContent = records.length +
      (records.length === 1 ? " response" : " responses");

    if (!records.length) {
      root.innerHTML = '<p class="empty">No responses yet. Completed runs on this browser ' +
        'will appear here.</p>';
      return;
    }

    var html = '<div class="table-wrap"><table><thead><tr>';
    cols.forEach(function (c) { html += "<th>" + esc(c[0]) + "</th>"; });
    html += "</tr></thead><tbody>";

    // Most recent first.
    records.slice().reverse().forEach(function (r) {
      html += "<tr>";
      cols.forEach(function (c) { html += "<td>" + esc(c[1](r)) + "</td>"; });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    root.innerHTML = html;
  }

  // --- CSV export of all rows in this view ---
  function csvCell(value) {
    var s = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadCSV() {
    var records = RC.getSubmissions();
    var cols = COLUMNS[view];
    var rows = [cols.map(function (c) { return c[0]; })];
    records.forEach(function (r) {
      rows.push(cols.map(function (c) { return c[1](r); }));
    });
    var csv = rows.map(function (row) { return row.map(csvCell).join(","); }).join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "rapidclaim-" + view + "-" +
      new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  document.getElementById("download-all").addEventListener("click", downloadCSV);

  document.getElementById("clear-all").addEventListener("click", function () {
    if (window.confirm("Delete ALL stored responses on this browser? This cannot be undone.")) {
      RC.clearSubmissions();
      render();
    }
  });

  document.getElementById("refresh").addEventListener("click", render);

  render();
})(window, document);
