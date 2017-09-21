import { Strictly } from "./lib/helpers";

export const C = Strictly({
  project: "runbelt",
  // vs code should work on dynamic commands
}, {
    commands: {
        cmd01: "runbelt.cmd01",
        cmd02: "runbelt.cmd02",
        cmd03: "runbelt.cmd03",
        cmd04: "runbelt.cmd04",
        cmd05: "runbelt.cmd05",
        cmd06: "runbelt.cmd06",
        cmd07: "runbelt.cmd07",
        cmd08: "runbelt.cmd08",
        cmd09: "runbelt.cmd09",
        cmd10: "runbelt.cmd10"
      }
});

export default C;
