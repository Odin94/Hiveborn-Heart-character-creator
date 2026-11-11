# Changelog

## Unreleased

- Redesign the whole app around a crimson-on-bone ("Heartlight") look with a dark
  soot-and-iron theme: a top bar with page links, account and theme toggle; a
  Cmd/Ctrl+K quick navigator; folder tabs for characters; notched section bands on the
  sheet; a reworked dice roller with an outcome ladder; and a three-column play table
  with a live roll feed, roster and loading skeletons. Destructive actions now use
  in-app confirmation dialogs, deleting a character offers Undo, and lists gain
  right-click menus.

- Connect a signed-in Hiveborn account to Stage through a browser consent page,
  preserving the connection request across WorkOS login and using a private
  loopback handoff without putting session tokens into URLs.

- Give class equipment choices and confirmation buttons more breathing room.

- Name class, calling, stress, and protection controls for accessible character editing.
- Preserve independent browser edits across tabs, keep conflicting drafts and recovery archives, and adopt clean cloud updates without creating duplicate sheets.
- Apply class and calling setup only after confirmation, preserve earned traits, and undo each application as one change.
- Keep delayed stress rolls attached to the original character and cancel rolls for deleted sheets.
- Retain sessions during temporary outages and keep WebSocket credentials out of request URLs and logs.
- Export Unicode names and notes to editable PDFs, with a warning for glyphs the embedded font cannot display.
