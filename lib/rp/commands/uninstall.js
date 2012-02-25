var term = require("ringo/term");
var semver = require("../utils/semver");
var packages = require("../utils/packages");
var shell = require("ringo/shell");

exports.description = "Uninstalls a package";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp uninstall <name> <version>\n");
    return;
};

exports.uninstall = function([name, version]) {
    if (!name) {
        throw new Error("Please specify the name of the package to uninstall");
    } else if (!packages.isInstalled(name)) {
        throw new Error("The package" + name + " isn't installed. Maybe a typo?");
    }
    var toUninstall = null;
    if (version != null) {
        version = semver.cleanVersion(version);
        if (!packages.isInstalled(name, version)) {
            throw new Error("Version " + version + " of " + name +
                    " isn't installed. Maybe a typo?");
        }
        toUninstall = [version];
    } else {
        toUninstall = packages.getInstalledVersions(name);
        if (toUninstall.length > 1) {
            term.writeln("About to uninstall the following versions of", name + ":");
            for each (let version in toUninstall) {
                term.writeln("  ", version);
            }
            if (!confirm("Do you really want to uninstall them?")) {
                return false;
            }
        }
    }
    uninstallPackages(name, toUninstall);
    return;
};

var confirm = function(msg) {
    var proceed = shell.readln(msg + " (y/N) ");
    if (proceed.toLowerCase() != "y") {
        term.writeln("Cancelled");
        return false;
    }
    return true;
};

var uninstallPackages = function(name, versions) {
    for each (let version in versions) {
        if (!uninstallPackage(name, version)) {
            return false;
        }
    }
    return true;
};

var uninstallPackage = function(name, version) {
    if (packages.isActivated(name, version)) {
        term.writeln("Version", version, "of package", name, "is currently active.");
        if (!confirm("Do you really want to uninstall it")) {
            return false;
        }
        packages.deactivate(name);
    }
    packages.uninstall(name, version);
    term.writeln(term.GREEN, "Uninstalled", name, version, term.RESET);
    return true;
}