---
name: backslashes
description: How to edit or write text that contains backslashes in this project (C# strings and verbatim strings, regexes, Windows and UNC paths, \r\n, JS '\\') and how to write test scripts that pass paths on. Load before any scripted edit or test script with a backslash in it.
---

# Backslashes

Text with backslashes gets mangled on the way through the shell here. It happened again and again: a Bash heredoc,
even a quoted one (`<<'EOF'`), reached the file with backslashes halved or dropped (`'\\'` became `'\'`, a regex
`/^[A-Za-z]:\\|^\\\\/` became `/^[A-Za-z]:\|^\\/`, `\r\n` became real line breaks, `D:\temp` became `D:` and a tab).
Python edit scripts fed through such a heredoc did the same, and an edit that does not match exactly fails or, worse,
matches and writes the wrong text.

## Editing code

- Any change with a backslash in the old or the new text: the **Edit** tool (or **Write** for a whole file). Never
  `sed`, `perl`, a Python or PowerShell replace script, or a heredoc through Bash.
- A scripted edit (many replacements at once) is fine only when none of its texts holds a backslash. Split the
  edits: the ones with backslashes go through Edit.
- After any scripted edit, grep the changed lines and look at them before building.

## Test scripts (PowerShell, CDP)

- Write a script with a backslash in it with the **Write** tool, or from the **PowerShell** tool; not with a Bash
  heredoc.
- `-split` takes a regex: `-split '\\'`, not `-split '\'`.
- A Windows path into a JS expression for CDP: build it in JS, so no escaping is needed:
  `"'" + (($path -split '\\') -join "' + String.fromCharCode(92) + '") + "'"`.
- Numbers for CDP (`Input.dispatchMouseEvent` x, y) as numbers (`[int]`), not strings from `Split`.
- No PowerShell function named after an alias: `start` is `Start-Process` and `move` is `Move-Item`, so such a
  function never runs (check a name with `Get-Alias name` first).
- Builds run from the PowerShell tool only (a Bash `-p:OutDir=...` loses its backslashes and leaves stray build folders
  in src and tests).
