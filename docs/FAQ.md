# FAQ and troubleshooting

## General

**Does AtelierRoot send my documents anywhere?**
No. There is no account, no cloud and no telemetry. The app makes no network requests at all.

**Can I keep using VS Code, Obsidian or git on the same folder?**
Yes. Files are plain `.md`. AtelierRoot reloads outside changes and never overwrites a file that changed
on disk without keeping your version as a copy.

**Why did my file change when I edited it?**
The first edit saves normalized Markdown (`*` -> `-`, aligned tables...). Opening without editing
never rewrites a file. If you do not want that for a file, do not edit it in AtelierRoot.

**How do I change the interface language?**
Press **EN/ES** in the toolbar, or search "Language" in the command palette (`Ctrl+Shift+P`). The choice
is remembered. A link can force a language for one visit: add `?lang=en` or `?lang=es` to the address.

**Are images stored as files?**
Not yet: pasted images are embedded in the `.md` as `data:` URLs. Images as separate files are on the roadmap.

**Does it work with OneDrive, Dropbox or iCloud folders?**
It should (changes are detected by date and size), but it has not been measured yet. Keep backups.

## Desktop app

**Windows says "Windows protected your PC" (SmartScreen).**
Early builds are not code-signed. Click **More info -> Run anyway** only if you downloaded the file
from this repository's Releases page. Signed builds are planned (roadmap S4).

**The app does not open on Windows.**
It needs Microsoft Edge WebView2, included in Windows 10 (updated) and 11. If missing, install the
"Evergreen Runtime" from Microsoft.

**Where is the chosen folder remembered?**
In the app's own settings folder. Choosing another folder from the app replaces it.

## HTML file (browser)

**Is `AtelierRoot.html` different from the executable?**
No. The executable embeds the same HTML file of the same release; only the way the folder is
opened differs (the browser asks for permission, the desktop app remembers the folder).

**Firefox / Safari cannot open a folder.**
They do not support the File System Access API. Use Chrome or Edge, or the desktop app.
In them the editor works in temporary mode (documents stay in the browser; **Export backup** saves them).
The automated tests run in Firefox and Safari's engine too. Known differences in Firefox: Enter at the end
of a quote and an extension's correction inside bold text can behave differently than in Chrome.

**Brave says it cannot open folders.**
Brave ships folder access turned off. Open `brave://flags/#file-system-access-api`, choose **Enabled** and restart Brave.

**VS Code's integrated browser stays in temporary mode.**
It is built on Electron, which lets you pick a folder but never grants access to it, so AtelierRoot does not offer the button there. Open the file in Chrome, Edge or Brave, or use the desktop app.

**My spelling or grammar extension does nothing in `AtelierRoot.html`.**
Most writing assistant extensions only run on `http`/`https` pages, so they never load in a
file opened from disk (`file://`), even with "Allow access to file URLs" turned on. Open the
same app from the web instead: <https://arphael.github.io/AtelierRoot/>. Your documents still
stay in your local folder. In the extension's details, set **Site access** to "On all sites"
(or add `arphael.github.io`). The desktop app does not run browser extensions; the editor's
built-in spell check (`spellcheck`) works everywhere.

**It asks for permission every time.**
Browsers grant folder access per session. The desktop app does not ask.

## Data safety

**I deleted something by mistake.** Open **Papelera** (Trash) and restore it (30 days).

**A copy named `... (versión del disco hh:mm)` appeared.** The file changed outside while you had
unsaved edits. Both versions are kept; compare and delete the one you do not need.

Still stuck? See [SUPPORT.md](../SUPPORT.md).
