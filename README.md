# Stackure JavaScript SDK

[![Check build](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml/badge.svg)](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml)
[![npm version](https://img.shields.io/npm/v/stackure.svg)](https://www.npmjs.com/package/stackure)
[![npm downloads](https://img.shields.io/npm/dm/stackure.svg)](https://www.npmjs.com/package/stackure)
[![Node.js version](https://img.shields.io/node/v/stackure.svg)](https://nodejs.org)
[![npm provenance](https://img.shields.io/badge/npm-provenance-blue)](https://docs.npmjs.com/generating-provenance-statements)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Add Stackure sign-in to a Node.js app with Express or Connect middleware. Zero dependencies.

## Install

```bash
npm install stackure
```

Needs Node.js 22 or later. ESM only.

## Example

Set `STACKURE_APP_ID` and `STACKURE_APP_SECRET` from the app's page in Stackure, then:

```js
import express from 'express';
import { auth, userFromRequest } from 'stackure';

const app = express();
app.use(auth());
app.get('/', (req, res) => res.json(userFromRequest(req)));
app.listen(3000);
```

## Documentation

Configuration, sign-in handoff, MCP, sign-out, errors and limits: [stackure.com/docs/javascript](https://stackure.com/docs/javascript)

## License

MIT
