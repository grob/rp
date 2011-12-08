var term = require("ringo/term");
var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var packages = require("../utils/packages");

exports.help = function help() {
    term.writeln("\nDeactivates a package.\n");
    term.writeln("Usage:");
    term.writeln("  rp deactivate <name>");
    return;
};

exports.info = function help() {
    term.writeln(term.BOLD, "  deactivate", term.RESET, "-", "Deactivate a package");
    return;
};

exports.deactivate = function deactivate([name]) {
    if (name.length < 1) {
        term.writeln(term.GREEN, "Please specify the name of the package to deactivate", term.RESET);
        return;
    }
    try {
        packages.deactivate(name);
        term.writeln(term.GREEN, "Package", name, "has been deactivated",
                term.RESET);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
    }
    return;
};
