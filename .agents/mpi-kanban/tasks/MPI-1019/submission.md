# Claude directory submission: the Cubric Studio plugin (for Fabio)

Where: **claude.ai/directory/manage** -> **Submit new** -> **Plugin bundle**. Needs a paid Claude
plan, and your GitHub account connected on claude.ai (the portal checks it can push to the repo).

## Source step

- **Repository:** `MadPonyInteractive/cubric-studio-agents`
- **Plugin path:** `plugins/cubric-studio`
- **Branch or tag:** leave empty (follows `main`)
- Press **Validate**. Expected: no Blocking findings. A **Policy hold** is possible (a reviewer
  reads it before it goes live); that is not a rejection.

## Listing details (read from the repo, nothing to type)

Name "Cubric Studio", description "Make images and video in the Cubric Studio app on this
computer.", the plugin folder's README as the long description, icon, docs / support / privacy
links (privacy = https://cubric.studio/privacy/). To change any of it, tell me and I push a fix.

## Data handling answers

- **Reads or stores personal data?** It passes your prompts, and the pictures and video you ask
  about, between Claude and the Cubric Studio app on your own computer. The plugin stores
  nothing; the app keeps your projects in your own Documents folder.
- **Sends data to services other than its declared connectors?** No. The plugin talks only to
  the app at `http://127.0.0.1:3000/mcp` on the same computer. (The app itself uses cloud
  services only when you choose a cloud model or RunPod, as its privacy policy lists.)
- **How long it keeps data:** the plugin keeps none.
- **Intended for people under 18?** No. Cubric Studio has an 18+ gate.

## Compliance step

Check the contact email is one you read: it is where Anthropic writes about the review, and it
is not shown publicly. Then tick the four acknowledgements.

## Review and submit

Keep **GitHub push webhook** (default). After submitting, **Set up push updates** needs admin on
the repo (you have it). Turning on auto-publish is optional; I would leave the reviewer default
for the first version.

## What a reviewer may notice

- The MCP address is a setting ("Cubric Studio address") whose default is the app on this
  computer. That is genuine: the app's port can be changed.
- Nothing in the plugin runs a program, downloads anything, or deletes anything.
