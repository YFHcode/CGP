# data/

Generated files — **do not edit by hand**.

`prices.json` and `history.json` are written by `scripts/refresh-data.mjs`, which
runs on a schedule in `.github/workflows/refresh-data.yml` and commits any
changes.

This is the only place upstream price APIs are called. The Next.js app reads
these files at build/request time, so API usage is a fixed cost per scheduled
run and does not scale with traffic, deploys, build workers or serverless
regions.

Both files start empty. Until the first successful workflow run the app falls
back to a direct (cached) API call so the site still works on a fresh clone.
