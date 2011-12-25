var config = require("../utils/config");
var term = require("ringo/term");
var shell = require("ringo/shell");
var {Parser} = require("ringo/args");
var log = require("ringo/logging").getLogger(module.id);
var fs = require("fs");
var semver = require("ringo-semver");
var registry = require("../utils/registry");
var httpclient = require("../utils/httpclient");
var packages = require("../utils/packages");

var parser = new Parser();
parser.addOption("v", "verbose", null, "Print verbose information");

exports.help = function help() {
    term.writeln("\nInstalls a package.\n");
    term.writeln("Usage:");
    term.writeln("  rp install [options] <name> [version]");
    term.writeln("\nOptions:");
    term.writeln(parser.help());
    return true;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  install", term.RESET, "-", "Install a new package");
    return true;
};

exports.install = function install(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }
    var packageName = args.shift();
    var version = args.shift();
    if (version != undefined) {
        try {
            version = semver.cleanVersion(version);
        } catch (e) {
            term.writeln(term.RED, "Invalid version number", version, term.RESET);
            return;
        }
    }
    // check if package exists in registry
    if (!registry.exists(packageName)) {
        term.writeln(term.RED, "Package '" + packageName + "' does not exist in registry", term.RESET);
        return false;
    } else if (version && !registry.exists(packageName, version)) {
        term.writeln(term.RED, "Version", version, "of package", packageName,
                "does not exist in registry", term.RESET);
        return false;
    }
    // check if package is already activated
    if (packages.isActivated(packageName)) {
        // TODO: display version number of active package
        term.writeln(term.RED, "Package", packageName,
                "is active, please deactivate or uninstall it", term.RESET);
        return false;
    }

    var descriptor = registry.getPackageDescriptor(packageName, version);
    var pkgList = packages.resolveDependencies(descriptor);
    if (pkgList.length > 1) {
        var toInstall = [pkg for each (pkg in pkgList)
            if (!packages.isInstalled(pkg.name, pkg.version) && !packages.isActivated(pkg.name, pkg.version))];
        var toActivate = [pkg for each (pkg in pkgList)
            if (!packages.isActivated(pkg.name, pkg.version))];
        // ask for confirmation to install dependent packages
        if (toInstall.length > 0) {
            term.writeln("\nAbout to", term.BOLD, "install", term.RESET,
                    "the following packages:");
            for each (var pkg in toInstall) {
                term.writeln("  ", pkg.name, pkg.version);
            }
        }
        if (toActivate.length > 0) {
            term.writeln("\nAbout to", term.BOLD, "activate", term.RESET, "the following packages:");
            for each (var pkg in toActivate) {
                term.writeln("  ", pkg.name, pkg.version);
            }
        }
        var confirmation = shell.readln("\nDo you want to proceed? (Y/n) ");
        if (confirmation != "" && confirmation != "y") {
            term.writeln("\nAborted");
            return false;
        }
        installPackages(toInstall);
        activatePackages(toActivate);
    }
    term.writeln(term.GREEN, "Finished", term.RESET);
    return true;
};

function installPackages(arr) {
    // loop over all packages in the list and install them
    for each (let descriptor in arr) {
        var archivePath = null;
        try {
            archivePath = installPackage(descriptor);
        } catch (e) {
            term.writeln(term.RED, e.message, term.RESET);
            // cleanup: remove temporary package archive file
            if (archivePath !== null && fs.exists(archivePath)) {
                fs.remove(archivePath);
            }
        }
    }
}

function activatePackages(arr) {
    for each (let descriptor in arr) {
        activatePackage(descriptor);
    }
}

function installPackage(descriptor) {
    if (!packages.isInstalled(descriptor.name, descriptor.version)) {
        var [archivePath, checksums] = registry.getPackage(descriptor);
        for each (var key in Object.keys(checksums)) {
            if (descriptor.checksums[key] !== checksums[key]) {
                throw new Error(key.toUpperCase() + " checksum mismatch");
            }
        }
        var dir = packages.install(archivePath, descriptor.name, descriptor.version);
        term.writeln("Installed", descriptor.name,
                descriptor.version, "in", fs.resolve(dir));

    } else {
        term.writeln("Package", descriptor.name, descriptor.version,
                "is already installed");
    }
    return archivePath;
}

function activatePackage(descriptor) {
    if (!packages.isActivated(descriptor.name)) {
        var link = packages.activate(descriptor.name, descriptor.version);
        term.writeln("Activated", descriptor.name,
                descriptor.version, "in", fs.resolve(link));
    } else {
        term.writeln("Package", descriptor.name, descriptor.version,
                "is already activated");
    }
}