var term = require("ringo/term");
var packages = require("../utils/packages");
var shell = require("ringo/shell");

exports.description = "Deactivates a package";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp deactivate <name>\n");
    return;
};

exports.deactivate = function deactivate([name]) {
    if (typeof(name) !== "string" || name.length < 1) {
        term.writeln("\nPlease specify the name of the package to deactivate\n");
        return;
    }
    if (packages.isActivated(name)) {
        var activeVersion = packages.getActivatedVersion(name);
        var proceed = shell.readln("Do you really want to deactivate " + name +
                " " + activeVersion + "? (y/N) ");
        if (proceed.toLowerCase() != "y") {
            term.writeln("Cancelled");
            return;
        }
        packages.deactivate(name);
        term.writeln(term.GREEN, "Deactivated", name, activeVersion, term.RESET);
    } else {
        term.writeln("Package", name, "isn't active");
    }
    return;
};
