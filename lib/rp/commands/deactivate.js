var term = require("ringo/term");
var packages = require("../utils/packages");

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
    packages.deactivate(name);
    term.writeln(term.GREEN, "Package", name, "has been deactivated", term.RESET);
    return;
};
