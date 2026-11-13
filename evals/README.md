# Evals

Held-out prompts: none of these concepts ships as an example. After the 0.3 round, the kit was changed in response to what these five prompts exposed, so they are no longer clean tests of generalisation: a later round should use prompts the kit was not shaped by, and say which kind it ran. Score each run on the criteria below, and record any manual repair. A with/without-skill comparison needs fresh sessions with the same model, prompt and tool budget.

Score each run on two lists. The first is whether a reader is better off; the second is whether the skill was followed. The 0.3 round scored only the second and the skill "won" five of five while teaching worse in four, so the first list decides.

**What the reader gets** (compare side by side with a run without the skill):

- the figure answers its question at a glance, before reading any caption
- it uses the shape the field draws for this concept, or says why it departs from it
- identities and the cause are drawn, not only captioned: which slot, which connection, what consumed what, where a rate comes from, when time is the subject
- it fits the deliverable asked for (a blog image reads on its own; a component drops into an app)

**Whether the skill was followed:**

- verify passes on the generated scene with no checks removed or weakened
- the model is tested against a separately written reference implementation, and the chosen inputs provably include the interesting cases
- the representation is the concept's own structure built from kit parts (or a new kit part), not a boxes-and-arrows diagram or a decorative metaphor
- no scene-specific CSS; no hand-typed numbers in the view
- one short action per step, a prediction before the causal moment, at most 5 chapters
- screenshots and contact sheets were read; defects found by eye were fixed in the kit when they would recur
