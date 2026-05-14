# Getting Started

1. `git checkout` to get the repository.
2. `cd` into the repository folder.
3. If you have NVM, `nvm use` to switch to the project's NodeJS version (v24).
4. `npm install` to get all the dependencies.
5. `npm run build` to compile. Artifacts in the `dist` folder, main application is `index.js`.
6. Use a local provider like Jan AI for quick local development and testing.
   Set the MCP server settings to use `node` command, `<ABSOLUTE PATH>/dist/index.js` as the first argument,
   followed by other arguments.
7. After any code change, you can `npm run build` and restart the MCP server to reflect changes live.

> [!NOTE]
> The server does not output anything when started so as to not corrupt the stdio for MCP communication.
> If you are trying to run it from the command line and it appears to freeze, it means it is running.


# Guidelines

- Pull requests should target the `dev` branch.
- Write unit tests. Just add a file in the same directory with the `**.test.ts` name format.


# Other npm Commands

- ```npm test``` to run all unit tests with `vitest`. It will pick up files with the `**.test.ts` format.
- ```npm run test:coverage``` to check which parts are untested.
- ```npm test -- src/utils``` to run tests for a specific path. In this case, all tests in the `src/utils` folder.
