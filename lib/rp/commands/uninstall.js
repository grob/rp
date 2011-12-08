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

exports.uninstall = function uninstall([name, version]) {
    if (!name) {
        term.writeln(term.RED, "Please specify the name of the package to uninstall", term.RESET);
    } else if (!packages.isInstalled(name)) {
        term.writeln(term.RED, "The package", name, "isn't installed. Maybe a typo?", term.RESET);
    } else if (!version && !(version = packages.getLatestInstalledVersion(name))) {
        term.writeln(term.RED, "Please specify the version to uninstall", term.RESET);
    } else {
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
    }
    return;
};
