# Product

## Register

product

## Users

LiftMark serves strength trainees who follow structured plans in the gym, often with 2-5 training partners sharing one device during a session. Core users include regular lifters, training partners, progressing strength or hypertrophy users, beginners applying templates, and future coaches or small teams.

## Product Purpose

LiftMark is an Android-first strength training plan executor and training record system. It replaces spreadsheet-based workout plans with a mobile workflow for selecting today's workout, calculating member-specific suggested weights, rotating group members through sets, recording completed work, and reviewing progress through reliable history, charts, and progression suggestions. The product is cloud-first, with local SQLite as the offline cache and weak-network training safeguard.

## Brand Personality

Professional, focused, practical. The interface should feel clean and training-floor friendly: clear enough to use between sets, direct enough for repeated use, and confident without decorative friction.

## Anti-references

Avoid marketing-page composition, ornamental dashboards, generic glass or gradient-heavy AI UI, hidden critical training actions, fake chart data, unclear axis labels, technical copy such as "local machine" in user-facing text, and temporary auth forms that split login methods into confusing entry points.

## Design Principles

1. Training flow first: weight, reps, current member, current set, and the next action must always be easy to see and tap.
2. Preserve trust in data: charts need real axes, dates, units, empty states, and labels that match the underlying metric.
3. Group logic is core product logic: member rotation, rest timers, summaries, and history must keep member ownership clear.
4. Keep low-frequency actions accessible but quiet: use bottom sheets, menus, and secondary entries without hiding essential operations.
5. Separate plan intent from workout reality: manual extra sets and substitutions affect the current session without rewriting the original plan.

## Accessibility & Inclusion

Use high-contrast text, large touch targets for training-floor controls, clear Chinese error messages, visible loading and disabled states, and reduced decorative motion. Product UI should prefer familiar controls, stable layout, readable numbers, and predictable focus or pressed states over novelty.
