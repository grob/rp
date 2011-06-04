var term = require("ringo/term");
var fs = require("fs");
var semver = require("ringo-semver");
var log = require("ringo/logging").getLogger(module.id);
var packages = require("../utils/packages");

exports.help = function help() {
    term.writeln("\nUninstalls a package.\n");
    term.writeln("Usage:");
    term.writeln("  rp uninstall <name> <version>");
    return;
};

exports.info = function help() {
    term.writeln(term.BOLD, "  uninstall", term.RESET, "-", "Uninstalls a package");
    return;
};

// TODO: use latest version if no version argument is given
exports.uninstall = function uninstall(args) {
    var [name, version] = args;
    if (!name) {
        term.writeln(term.RED, "Please specify the name of the package to uninstall", term.RESET);
        return;
    } else if (!version) {
        term.writeln(term.RED, "Please specify the version to uninstall", term.RESET);
        return;
    }
    try {
        version = semver.cleanVersion(version);
        if (packages.isActivated(name)) {
            packages.deactivate(name);
        }
        packages.uninstall(name, version);
        term.writeln(term.GREEN, "Uninstalled", name, version, term.RESET);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        return;
    }
    return;
};
