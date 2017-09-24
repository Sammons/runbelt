# runbelt README

Runbelt is for that moment when you really just want to seamlessly run a script without leaving the comfort of your editor.

## Features

10 configurable commands which can be bound to hotkeys.

runbelt.cmd01
runbelt.cmd02
...
runbelt.cmd10

### Getting started

  1) Set your runbelt.bin path in Preferences -> Settings
    e.g. ` "runbelt.bin": "/bin/sh" `
    note that runbelt will attempt to auto-detect sh/bash but that will invariably work
    less well than a hand-picked path by you.

  2) Configure runbelt.cmd01 setting in Preferences -> Settings
    e.g. ` "runbelt.cmd01": { "location": "~/.runbelt/cmd01.sh" } `

  3) Bind runbelt.cmd01 in Preferences -> Keyboard Shortcuts

  4) Enjoy!

### To bind a command to a hotkey 

  1) Go to Preferences -> Keyboard Shortcuts

  2) Search for runbelt.cmd01 (or cmd02 ... up to 10)

  3) Select a keybinding for the command that shows up

### Killing a command
  A single slot will not run repeatedly concurrently, re-running the command while it is still
  in progress will instead cancel the previous command.

  This does not apply when running in a terminal, which will open an individual terminal
  for every instance of the command

## Extension Settings

```
"runbelt.bin": "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "runbelt.cmd01": {
        // (required) this file will be run, if in shell mode it gets dumped to the shell
        "location": "~/.runbelt/cmd.sh", 
        
        // (optional) run in an integrated terminal, not all other settings
        // apply when running in a terminal:
        // "customArgs", "args", "cwd" have no effect
        "shell": true,

        // (optional) list of arguments to be passed to the command
        "args": [],
        
        // (optional) if set to true, vscode will prompt for arguments before running
        "customArgs": false, 
        
        // (optional) current project directory, understands paths including ~
        "cwd": ".", 
        
        // (optional) upon running, will focus the output, stealing focus from the current document
        "focus": false, 
        
        // (optional) vanity name of the command to help distinguish commands
        // shows in the bottom of the editor in the status indicator
        "name": "",

        // (optional) pops up a panel to view the output of the command
        // when set to false, the output can be accessed by clicking the status
        // indicator in the bottom margin of the editor
        "show": true
    }
```

## Known Issues

## Release Notes

## [0.0.3]
- Initial release

## [0.0.4]
- Clarify message when location is missing for a command that is run

## [0.0.6]
- Make missing location actionable

## [0.0.7]
- Fix bug where empty cwd causes issue
- Add action (Configure) when bin not guessed, or not found
- upcase "configure" action text when displayed after not finding something

## [0.0.8]
- Stop showing warning about CWD when it isn't set

## [0.0.9]
- Fix error when args is not set and customArgs is true

## [0.0.10]
- Fix bug where re-running the same command lots of times doesn't show status correctly until it cools off

**Enjoy!**

## License (MIT)

Copyright 2017 Ben Sammons

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

