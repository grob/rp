var term = require("ringo/term");
var semver = require("ringo-semver");
var packages = require("../utils/packages");

exports.description = "Uninstalls a package";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp uninstall <name> <version>\n");
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
        version = semver.cleanVersion(version);
        if (packages.isActivated(name)) {
            packages.deactivate(name);
        }
        packages.uninstall(name, version);
        term.writeln(term.GREEN, "Uninstalled", name, version, term.RESET);
    }
    return;
};
