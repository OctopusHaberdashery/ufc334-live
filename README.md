# UFC Fight Night Live

Live results for every UFC event, installable on iPhone (Safari > Share > Add to Home Screen).

- **Live data:** the app reads ESPN's public fight center feed directly from the browser: card order, live round and clock, results, method, judges' scores, sig strikes, takedowns, knockdowns, control time, records and photos. It refreshes every 20 seconds during a live event.
- **Event list:** `events/index.json`, rebuilt by the "Update UFC event list" GitHub Action every 30 minutes on Saturday nights and daily otherwise.
- **Hand-written notes:** odds, storylines, rankings and round notes live in the DATA block of `source.html` (UFC 334) and are merged on top of the live feed. Add an event by mapping its ESPN id to a JSON file in `OVERLAYS` in `tools/app-loader.js`.

Edit `source.html` or `tools/app-loader.js`, run `node tools/build.js`, then push.
