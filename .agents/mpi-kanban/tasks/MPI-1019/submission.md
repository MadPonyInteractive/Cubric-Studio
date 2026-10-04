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

## Data handling answers (as submitted 2026-10-04; the portal asks multiple choice)

- **Reads or stores personal data (names, emails, addresses)?** No. It passes prompts and
  pictures between Claude and the app on the user's computer.
- **Does any skill send data to a service other than the declared connectors?** No.
- **How long does your service retain data received from Claude?** Under 30 days: the privacy
  page says Mad Pony keeps nothing except a reference video for a cloud video, deleted within the
  hour; projects stay on the user's own computer.
- **Intended for users under 18?** No. Cubric Studio has an 18+ gate.

## Compliance step

Check the contact email is one you read: it is where Anthropic writes about the review, and it
is not shown publicly. Then tick the four acknowledgements.

## Review and submit

As submitted: **Scheduled check only** (the directory looks at `main` about every 6 hours;
**Check for new commits** on the plugin page forces it), and **Auto-publish passing versions
OFF**, so an agent's push to the public repo never goes live in the directory without Fabio
pressing Publish. Either can change later on the plugin's Settings tab.

## What a reviewer may notice

- The MCP address is a setting ("Cubric Studio address") whose default is the app on this
  computer. That is genuine: the app's port can be changed.
- Nothing in the plugin runs a program, downloads anything, or deletes anything.
