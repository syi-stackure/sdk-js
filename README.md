# Stackure JavaScript SDK

[![Check build](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml/badge.svg)](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml)
[![npm version](https://img.shields.io/npm/v/stackure.svg)](https://www.npmjs.com/package/stackure)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Stackure](https://stackure.com) is passwordless auth for B2B apps. This SDK adds it to a Node.js app as Express or Connect middleware, with zero dependencies.

## Install

```bash
npm install stackure
```

Needs Node.js 22 or later. ESM only.

## Quickstart

Set `STACKURE_APP_ID` and `STACKURE_APP_SECRET` from the app's page in Stackure, then:

```js
import express from 'express';
import { auth, userFromRequest } from 'stackure';

const app = express();
app.use(auth());
app.get('/', (req, res) => res.json(userFromRequest(req)));
app.listen(3000);
```

## Docs

- Guide and reference: [stackure.com/docs/javascript](https://stackure.com/docs/javascript)
- For AI agents: [stackure.com/llms.txt](https://stackure.com/llms.txt)

## License

MIT
