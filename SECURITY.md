# Security policy

## Supported versions

Security fixes go into the latest release. Please upgrade with `git pull` in the folder where the skill is installed.

| Version | Supported |
|---|---|
| 1.x (latest) | Yes |
| Older | No |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately through GitHub: on the repository's **Security** tab, choose **Report a vulnerability**. Only the maintainers can see the report.

Include what you found, the steps to reproduce it, and what an attacker could do with it. You should hear back within a week. Once a fix is released, you will be credited in the release notes unless you would rather not be.

## Scope

Visualize runs on the machine of the person who installs it: an agent reads `SKILL.md`, writes scene code, and runs the scripts in this repository with Node.js and a headless Chrome. Reports we especially want:

- a script that reads or writes outside the folders it is given;
- a built page that runs code or loads resources from outside the page;
- anything that sends a user's files, prompts or recordings off the machine (the voice model is downloaded once and then runs locally; nothing is uploaded).
