# H03 — A delayed stress roll can damage the wrong character

Severity: **High**. Confirmed with the running sheet at `8a0544f`; screenshot: `../../../evidence/hiveborn-stress-wrong-character.png`.

## Reproduction and evidence

Create A and B, select A, and roll Blood stress. During the 1.6-second animation, delete A (or remove an earlier sheet so A's array position shifts). The completed roll uses the original numeric index, which now refers to B.

A deterministic d6 reproduction left deleted A at zero Blood stress in recovery and assigned **6 Blood stress to innocent B**. The test used the actual Blood button and d6 selector; deletion used the same store action as the UI. Live reconciliation can also reorder the array while the timer is pending.

## Cause

`src/hiveborn/character_sheet/components/stress_counter/stress_roll_dialog.tsx` captures `currentCharacterIndex` and later looks up that index. Character indices are not stable identities.

## Suggested fix

Capture the target UUID and find it again when the roll completes. If it has been deleted, leave other sheets untouched and report/cancel the roll. Apply the update by UUID and clamp against the target's current stress.

Regression: switching selection, deleting the target, deleting an earlier character, and a remote reconciliation during the animation.
