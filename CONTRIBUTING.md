# Contributing

Redact is small on purpose. The best contribution is a new **detector**: one more kind of personal detail it can find.

## Set up

```
npm install
npm test
npm run build
npm run serve     # http://localhost:8080
```

## Add a detector

1. Open `engine/detect.js`. Each kind has a name, a label shown to people, and a function that finds matches in the text read from the picture.
2. If the detail has a check digit (like Aadhaar or a card number), put the checksum in `engine/checks.js` and use it, so random numbers are not blacked out.
3. Add the kind to `PRIORITY` so overlaps are settled the same way every time.
4. Add tests in `tests/detect.test.js`: values that must be found, and look-alikes that must not.

## Rules that never bend

- **Made-up test data only.** Never commit a real ID, card, phone number or address.
- **Nothing leaves the device.** No analytics, no fonts from a CDN, no network calls. The page's Content-Security-Policy (in `web/index.html`) blocks them. Do not loosen it.
- **Plain words** in anything people read.

Questions and ideas are welcome as issues.
