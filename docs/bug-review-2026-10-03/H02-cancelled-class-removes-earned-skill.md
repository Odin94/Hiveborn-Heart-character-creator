# H02 — Cancelled class setup can remove an independently earned skill

Severity: **High**. Confirmed through the class dropdown and dialogs at `8a0544f`; screenshot: `../../../evidence/hiveborn-class-cancel.png`.

Revalidated on committed revision `88c2eb0` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

1. Start without a class and independently mark Hunt as trained; optionally add a knack.
2. Select Cleaver and **Cancel** the core-traits dialog.
3. Select Deadwalker and **Apply** its core traits.

After cancellation the stored class is already Cleaver, despite its traits never being applied. Applying Deadwalker clears the independently earned Hunt skill (`hasSkill: true → false`) while leaving its knack text. Delve is added as expected.

## Cause

`src/hiveborn/character_sheet/components/name_class_calling.tsx` changes `characterClass` during menu selection, before confirmation. The next operation assumes the selected old class supplied all its core skills/domains. `removeClassBonusesFromDraft` then clears their flags without knowing their origin. Calling changes use the same destructive inference.

## Suggested fix

Keep a pending selection until Apply and restore/discard it on Cancel or dialog dismissal. Track applied class/calling grants separately from independently earned progression, so changing a class removes only its own grants. Apply the operation atomically so one Undo reverses the whole confirmed change.

Regression: cancel then select another class; change classes with independently gained overlapping skills/domains; preserve knacks and protection gained from other sources.
