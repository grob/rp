var term = require("ringo/term");
var fs = require("fs");
var semver = require("ringo-semver");
var log = require("ringo/logging").getLogger(module.id);
var packages = require("../utils/packages");

exports.help = function help() {
    term.writeln("\nActivates a package.\n");
    term.writeln("Usage:");
    term.writeln("  rp activate <name> <version>\n");
    return;
};

exports.info = function help() {
    term.writeln(term.BOLD, "  activate", term.RESET, "-", "Activates a package");
    return;
};

exports.activate = function activate([name, version]) {
    if (!name) {
        term.writeln(term.RED, "Please specify the name of the package to activate", term.RESET);
    } else if (!packages.isInstalled(name)) {
        term.writeln(term.RED, "The package", name, "isn't installed. Maybe a typo?", term.RESET);
    } else if (!version && !(version = packages.getLatestInstalledVersion(name))) {
        term.writeln(term.RED, "Please specify the version to activate", term.RESET);
    } else {
        version = semver.cleanVersion(version);
        packages.activate(name, version);
        term.writeln(term.GREEN, "Successfully activated", name,
                "(v" + version + ")", term.RESET);
    }
};
