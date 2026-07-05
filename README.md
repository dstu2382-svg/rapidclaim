# RapidClaim — Property Claim Prototype

A low-fidelity, static prototype that simulates a property insurance claim service, built for
usability testing. Testers walk through three sections:

1. **Welcome** — explains the purpose of the test and sets expectations.
2. **Claim** — a short form (name, claim type, estimated loss) that returns a **simulated**
   assessment and payout offer.
3. **Survey** — a few questions about the experience.

All logic runs in the browser. Responses are saved to the browser's `localStorage` and can be
downloaded as JSON or CSV at the end. No backend, no data leaves the tester's device.

> ⚠️ This is a prototype for testing only. The assessment result and payout are randomised for
> demonstration and do not reflect any real insurance logic.

## Run locally

You need Python installed. From this folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

(On some systems the command is `python3` instead of `python`.)

## Project structure

```
website1/
├── index.html        # All three sections + progress bar
├── css/
│   └── style.css     # Styling (no framework, no dependencies)
├── js/
│   ├── storage.js    # Shared state, localStorage, CSV/JSON downloads
│   ├── app.js        # Navigation, claim form, mock assessment
│   └── survey.js     # Survey handling, thank-you screen, restart
└── README.md
```

## Collecting results from testers

Each tester can click **Download JSON** or **Download CSV** on the final screen and send you the
file. The in-progress run is stored under `localStorage` key `rapidclaim.session`; every completed
run is appended to `rapidclaim.submissions`.

### Designer view pages

Two pages let a prototype designer review collected answers:

- **`/results/claims.html`** — claim assessment answers (name, type, loss, outcome, payout, path,
  bank details).
- **`/results/survey.html`** — survey answers (demographics + questions).

Each page shows a table (most recent first) with **Download CSV** and **Clear all** buttons.

> ⚠️ Because there is no server, these pages only show runs completed in the **same browser**. They
> do not aggregate responses across different testers/devices. To collect centrally you'd need a
> backend or a form service (e.g. a Google Form or a hosted endpoint) — ask if you want that added.

## Deploy to GitHub Pages

Because the site is fully static, it deploys as-is:

1. Create a GitHub repository and push these files to it.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your branch (e.g.
   `main`) and the `/ (root)` folder, then **Save**.
4. Your prototype will be live at `https://<username>.github.io/<repo>/` within a minute or two.

No build step or configuration is required.

## Customising

- **Claim types** — edit the `<select id="claim-type">` options in `index.html`.
- **Assessment behaviour** — adjust the `assess()` function in `js/app.js` (outcome weighting,
  payout ranges, processing delay).
- **Survey questions** — edit the `<fieldset>` blocks in `index.html`; if you add/remove rating
  questions, update the `RATINGS` list in `js/survey.js` and the CSV columns in `js/storage.js`.
- **Look & feel** — colours and spacing are CSS variables at the top of `css/style.css`.
