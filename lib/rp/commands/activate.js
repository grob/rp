var term = require("ringo/term");
var semver = require("../utils/semver");
var packages = require("../utils/packages");
var shell = require("ringo/shell");

exports.description = "Activates a package";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp activate <name> [version]\n");
    return;
};

exports.activate = function activate([name, version]) {
    if (!name) {
        throw new Error("Please specify the name of the package to activate");
    } else if (!packages.isInstalled(name)) {
        throw new Error("The package", name, "isn't installed. Maybe a typo?");
    }
    if (version != null) {
        version = semver.cleanVersion(version);
    } else {
        version = packages.getLatestInstalledVersion(name);
        if (!version) {
            throw new Error("Please specify the version to activate");
        }
    }
    activatePackage(name, version);
};

var activatePackage = exports.activatePackage = function(name, version) {
    var activeVersion = packages.getActivatedVersion(name);
    if (activeVersion !== null) {
        if (activeVersion === version) {
            throw new Error("Version " + version + " of package " + name + " is already active");
        }
        term.writeln("Version", activeVersion, "of", name, "is currently active.");
        var proceed = shell.readln("Do you want to activate version " +
                version + "? (y/N) ");
        if (proceed.toLowerCase() != "y") {
            term.writeln("Cancelled");
            return false;
        }
    }
    packages.activate(name, version);
    term.writeln(term.GREEN, "Activated", name, version, term.RESET);
    return true;
};
