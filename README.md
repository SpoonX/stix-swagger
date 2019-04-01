# ![Stix swagger](./stix-swagger.svg)

[![Slack Status](https://spoonx-slack.herokuapp.com/badge.svg)](https://spoonx-slack.herokuapp.com)

A [stix](https://github.com/SpoonX/stix) module that generates swagger docs based on your stix app.

It currently works with:

- stix-gates
- stix-schema
- stix-wetland
- stix-security

All of these you'll want to use anyway, stix-swagger just uses them to build your swagger docs for you.

## Installation

The same as any other stix module. `yarn add stix-swagger` and add it to your `modules.ts` config.

The server then gets started when NODE_ENV is not production (so in dev).

I like to add this to my app.ts so it always outputs the swagger url in dev when running the server:

```ts
import chalk from 'chalk';
import stix, { Application, ApplicationModes, ServerService } from 'stix';
import * as config from './config';

(async () => {
  const mode: ApplicationModes = process.env.STIX_APPLICATION_MODE as ApplicationModes;
  const app: Application = await stix(config).launch(mode);

  if (app.getMode() === ApplicationModes.Server && !app.isProduction()) {
    const url = app.getServiceManager().get(ServerService).getURL();

    console.log(chalk`\n\t{bold {green Server ready. Happy hacking!}}`);
    console.log(chalk`\n\t{bold Server:\t\t${url}}`);
    console.log(chalk`\t{bold Swagger docs:\t${url}swagger/ui}\n`);
  }
})();
``` 

## License

MIT.
