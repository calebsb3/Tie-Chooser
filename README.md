# Tie-Chooser

A lightweight pure JavaScript app to help you rotate through your tie collection without repeats.

## Features

- Upload tie images and keep a personal collection in browser storage
- Get a random recommendation from ties not yet worn in the current cycle
- Mark the recommended tie as worn with the current date
- View wear history by tie and date
- Automatic cycle reset after all ties have been worn once
- Separate Collection, Recommendation, and Wear History pages for a cleaner flow

## Run locally

Because this is a static app, you can open `index.html` directly, or run a simple local server:

```bash
python -m http.server 8000
```

Then use:

- `index.html?page=collection` for Collection
- `index.html?page=recommendation` for Recommendation
- `index.html?page=history` for Wear History

Notes:

- `recommendation.html` and `history.html` redirect to their corresponding `index.html?page=...` views.
