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
  const settings: {
    bin?: string;
    location?: string;
    cmd01?: string;
    cmd02?: string;
    cmd03?: string;
    cmd04?: string;
    cmd05?: string;
    cmd06?: string;
    cmd07?: string;
    cmd08?: string;
    cmd09?: string;
    cmd10?: string;
  } = {};
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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  console.log("activate");
  let latestPanel: { show } = null;
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
                  `Does not exist: ${location}`
                );
              }
              location = location.replace("~", os.homedir());
              const resolvedLoc = path.resolve(location);
              if (!fs.existsSync(resolvedLoc)) {
                return vscode.window.showInformationMessage(
                  `Does not exist: ${resolvedLoc}`
                );
              } else {
                const status = vscode.window.createStatusBarItem();
                context.subscriptions.push(status);
                status.text = "Running" + (name || cmdKey);
                status.command = "runbelt.showLatestPanel";
                status.show();

                if (shell === false) {
                  const channel = vscode.window.createOutputChannel(
                    name || cmdKey
                  );
                  latestPanel = channel;
                  context.subscriptions.push(channel);

                  if (show === false) {
                    channel.hide();
                  } else {
                    channel.show(true);
                  }
                  const spawned = childProcess.spawn(
                    bin,
                    [resolvedLoc].concat(args || []),
                    {
                      shell: false,
                      env: process.env
                    }
                  );
                  spawned.stdout.on("data", d => {
                    channel.append(d.toString());
                  });
                  spawned.stderr.on("data", d => {
                    channel.append(d.toString());
                  });
                  spawned.on("error", err => {
                    channel.appendLine(`Failure ${err.message}`);
                  });
                  return new Promise((resolve, reject) => {
                    spawned.on("exit", (code, signal) => {
                      channel.appendLine(
                        `Finished with code: ${code}, signal: ${signal}`
                      );
                      status.text = `Finished ${name ||
                        cmdKey} with code:${code}`;
                      setTimeout(() => {
                        channel.dispose();
                        status.dispose();
                      }, 10000);
                      resolve();
                    });
                  });
                } else {
                  const channel = vscode.window.createTerminal(
                    name || cmdKey,
                    bin
                  );
                  latestPanel = channel;
                  context.subscriptions.push(channel);
                  channel.sendText(`${bin} ${resolvedLoc}`);
                  if (show === false) {
                    channel.hide();
                  } else {
                    channel.show(true);
                  }
                  return channel.processId.then(pid => {
                    return new Promise((resolve, reject) => {
                      const ref = setInterval(() => {
                        ps.lookup({ pid: 12345 }, (err, proc) => {
                          if (err) {
                            clearInterval(ref);
                            reject(err);
                          } else {
                            if (proc) {
                            } else {
                              status.text = `Finished running ${name ||
                                cmdKey}`;
                              setTimeout(() => {
                                status.dispose();
                              }, 5000);
                              clearInterval(ref);
                              resolve();
                            }
                          }
                        });
                      }, 5000);
                    });
                  });
                }
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
      })
    );
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
