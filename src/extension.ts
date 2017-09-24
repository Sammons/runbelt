"use strict";
import { setTimeout } from "timers";
import * as childProcess from "child_process";
import "source-map-support/register";
import { ResolverPlugin } from "./types";
import { AtPath } from "./lib/helpers";
import { C } from "./constants";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { CompletionItemProvider, DocumentSelector } from "vscode";
import * as _ from "lodash";
import * as fs from "fs";
import * as path from "path";
import * as bluebird from "bluebird";
import * as os from "os";
import * as ps from "ps-node";
type Setting = {
  name: string;
  location: string;
  shell: boolean;
  show: boolean;
  args: string[];
  customArgs: boolean;
  cwd: string;
  focus: boolean;
};
type Settings = {
  bin?: string;
  location?: string;
  cmd01?: Setting;
  cmd02?: Setting;
  cmd03?: Setting;
  cmd04?: Setting;
  cmd05?: Setting;
  cmd06?: Setting;
  cmd07?: Setting;
  cmd08?: Setting;
  cmd09?: Setting;
  cmd10?: Setting;
};
function getSettings() {
  const settingKeys = [
    "bin",
    "location",
    "cmd01",
    "cmd02",
    "cmd03",
    "cmd04",
    "cmd05",
    "cmd06",
    "cmd07",
    "cmd08",
    "cmd09",
    "cmd10"
  ];
  const settings: Settings = {};
  settingKeys.forEach(key => {
    settings[key] = vscode.workspace.getConfiguration(`runbelt`).get(key);
  });
  return settings;
}

async function findBin(overridePath?: string): Promise<Error | string> {
  if (overridePath) {
    if (overridePath.includes("~")) {
      overridePath = overridePath.replace("~", os.homedir());
    }
    const binPath = path.resolve(overridePath);
    const binExists = fs.existsSync(binPath);
    if (binExists) {
      const stat = fs.statSync(binPath);
      if (stat.isFile()) {
        return binPath;
      } else {
        return new Error("path is not regular file");
      }
    } else {
      return new Error("could not find bin");
    }
  } else {
    console.log("searching");
    const PATH = process.env.PATH;

    if (!PATH) {
      return new Error("no PATH environment variable, could not find bin");
    }

    const placesToLook = process.env.PATH
      .split(path.delimiter)
      .map(place => path.resolve(place));

    // this is what they call callback hell
    const testLocation = (place, cb) => {
      fs.exists(place, bool => {
        if (bool) {
          fs.stat(place, (err, stat) => {
            if (err) {
              cb(err);
            } else {
              if (stat.isDirectory()) {
                fs.readdir(place, (err, files) => {
                  if (err) {
                    cb(err);
                  } else {
                    for (let file of files) {
                      if (
                        file === "bash" ||
                        file === "bashe.exe" ||
                        file === "sh" ||
                        file === "sh.exe"
                      ) {
                        return cb(null, path.join(place, file));
                      }
                    }
                    return cb(null, false);
                  }
                });
              } else {
                return cb(null, false);
              }
            }
          });
        } else {
          cb(null, false);
        }
      });
    };

    const testLocationP = bluebird.promisify(testLocation);

    for (let place of placesToLook) {
      try {
        console.log("searching place", place);
        let result = await testLocationP(place);
        console.log("result", result);
        if (typeof result === "string") {
          return result;
        }
      } catch (e) {
        console.log("error", e);
      }
    }
    return new Error("could not find sh");
  }
}

const running: {
  [x: string]: {
    finished?: boolean;
    proc: childProcess.ChildProcess;
    status: vscode.StatusBarItem;
  };
} = {};

function cleanup(cmdKey: string) {
  if (running[cmdKey]) {
    running[cmdKey].proc.kill();
    running[cmdKey].status.dispose();
    running[cmdKey] = null;
  }
}

function register(
  cmdKey,
  proc: childProcess.ChildProcess,
  status: vscode.StatusBarItem
) {
  running[cmdKey] = {
    proc,
    status
  };
}

let latestPanel: vscode.OutputChannel = null;
function getOutputPanel() {
  const channel =
    latestPanel == null
      ? vscode.window.createOutputChannel("Runbelt")
      : latestPanel;

  latestPanel = channel;
  return channel;
}

async function resolveLocationAndRun(
  command: string,
  thenRun: (
    bin: string,
    setting: Setting,
    loc: string,
    cmdKey: string
  ) => Thenable<any | void>
) {
  try {
    const settings = getSettings();
    const cmdKey = command.split(".").pop();
    if (settings[cmdKey]) {
      const bin = await findBin(settings.bin);
      if (bin instanceof Error) {
        return vscode.window.showErrorMessage(bin.message);
      } else {
        let { location, name, immediate, show, shell, args } =
          settings[cmdKey] || ({} as any);
        if (!location) {
          return vscode.window.showInformationMessage(
            `Does not exist: ${location}, please configure runbelt.${cmdKey} in your settings`
          );
        }
        location = location.replace("~", os.homedir());
        const resolvedLoc = path.resolve(location);
        if (!fs.existsSync(resolvedLoc)) {
          return vscode.window.showInformationMessage(
            `Does not exist: ${resolvedLoc}, please configure runbelt.${cmdKey} in your settings`
          );
        } else {
          return thenRun(bin, settings[cmdKey] as Setting, resolvedLoc, cmdKey);
        }
      }
    } else {
      return vscode.window.showInformationMessage(
        `Runbelt slot for ${cmdKey} is empty`
      );
    }
  } catch (e) {
    console.log("error", e);
  }
}

async function runInBackground(
  context: vscode.ExtensionContext,
  bin: string,
  setting: Setting,
  pathToCmd: string,
  cmdKey: string
) {
  const { name, shell, show, focus, args, customArgs, cwd } = _.cloneDeep(
    setting
  );
  const status = vscode.window.createStatusBarItem();
  context.subscriptions.push(status);
  status.text = "Running" + (name || cmdKey);
  status.command = "runbelt.showLatestPanel";
  status.show();
  const channel = getOutputPanel();
  if (show === false && focus !== true) {
    channel.hide();
  } else {
    const preserveFocus = !focus;
    channel.show(preserveFocus);
  }
  const prevWasDone = !running[cmdKey] || running[cmdKey].finished;
  if (running[cmdKey]) {
    if (!running[cmdKey].finished) {
      channel.appendLine(
        `${name ||
          cmdKey} already running. Terminating it. Run the command again to start a new instance.`
      );
    }
    status.dispose();
    cleanup(cmdKey);
  }
  if (prevWasDone) {
    if (customArgs) {
      await vscode.window
        .showInputBox({
          placeHolder: "arguments, e.g. --tail=200 -f"
        })
        .then(value => {
          _.filter(value.match(/(\'.*?\')|(\".*?\")|\w+/g) || []).forEach(el =>
            args.push(el)
          );
        });
    }
    const resolveCwd = (cwd) => {
      let _cwd = cwd.replace('~', os.homedir());
      let workdir = vscode.workspace.rootPath;
      if (_cwd === ".") {
        return workdir;
      }
      if (_cwd.startsWith(`.${path.sep}`)) {
        return path.resolve(workdir, path.normalize(_cwd))
      }
      return path.resolve(path.normalize(_cwd));
    }
    let placeToRunIn = resolveCwd(cwd)
    if (!fs.existsSync(placeToRunIn)) {
      channel.appendLine(`WARN: ${placeToRunIn} does not exist, running in default cwd`);
      placeToRunIn = resolveCwd(".");
    }
    const spawned = childProcess.spawn(bin, [pathToCmd].concat(args || []), {
      shell: false,
      env: process.env,
      cwd: placeToRunIn
    });
    let summary = "";
    spawned.stdout.on("data", d => {
      summary = d.toString().substr(0, 60);
      channel.append(d.toString());
    });
    spawned.stderr.on("data", d => {
      summary = d.toString().substr(0, 60);
      channel.append(d.toString());
    });
    spawned.on("error", err => {
      summary = err.message.toString().substr(0, 60);
      channel.appendLine(`Failure ${err.message}`);
    });
    register(cmdKey, spawned, status);
    return new Promise((resolve, reject) => {
      spawned.on("exit", (code, signal) => {
        running[cmdKey].finished = true;
        channel.appendLine(`Finished with code: ${code}, signal: ${signal}`);
        status.text = `Finished ${name || cmdKey}. code: ${code}, ${summary}`;
        setTimeout(() => {
          status.dispose();
          running[cmdKey] = null;
        }, 10000);
        resolve();
      });
    });
  }
}

async function runInShell(
  context: vscode.ExtensionContext,
  bin: string,
  setting: Setting,
  pathToCmd: string,
  cmdKey: string
) {
  const { name, shell, show, focus, args, customArgs } = _.cloneDeep(setting);
  const channel = vscode.window.createTerminal(name || cmdKey, bin);
  context.subscriptions.push(channel);
  channel.sendText(`${fs.readFileSync(pathToCmd)}`);
  if (show === false && focus !== true) {
    channel.hide();
  } else {
    const preserveFocus = !focus;
    channel.show(preserveFocus);
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("activate");
  context.subscriptions.push(
    vscode.commands.registerCommand("runbelt.showLatestPanel", () => {
      if (latestPanel != null) {
        latestPanel.show();
      }
    })
  );
  _.values(C.commands).forEach(command => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, async () => {
        return resolveLocationAndRun(
          command,
          (bin, setting, pathToCmd, cmdKey) => {
            const { shell } = setting;
            if (shell !== true) {
              return runInBackground(context, bin, setting, pathToCmd, cmdKey);
            } else {
              return runInShell(context, bin, setting, pathToCmd, cmdKey);
            }
          }
        );
      })
    );
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
