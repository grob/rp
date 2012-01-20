var term = require("ringo/term");
var shell = require("ringo/shell");
var fs = require("fs");
var semver = require("ringo-semver");
var registry = require("../utils/registry");
var packages = require("../utils/packages");

exports.description = "Install a new package";

exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp install <name> [version]\n");
    return true;
};

exports.install = function([packageName, version]) {
    if (!packageName) {
        throw new Error("Please specify the name of the package to install");
    } else if (version != null) {
        version = semver.cleanVersion(version);
    }

    // check if package exists in registry
    if (!registry.exists(packageName)) {
        throw new Error("Package '" + packageName + "' does not exist in registry");
    } else if (version && !registry.exists(packageName, version)) {
        throw new Error("Version " + version + " of package " + packageName + " does not exist in registry");
    }

    // check if package is already activated
    if (packages.isActivated(packageName)) {
        throw new Error("Package " + packageName + " is active, please deactivate or uninstall it");
    }

    var descriptor = registry.getPackageDescriptor(packageName, version);
    if (descriptor == null) {
        throw new Error("Package cache is outdated, please do a 'rp cache init'");
    }
    var pkgList = packages.resolveDependencies(descriptor);
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
    toInstall.forEach(installPackage);
    toActivate.forEach(activatePackage);
    return true;
};

var installPackage = function(descriptor) {
    var archivePath = null;
    var checksums = null;
    try {
        var [archivePath, checksums] = registry.getPackage(descriptor);
        for each (var key in Object.keys(checksums)) {
            if (descriptor.checksums[key] !== checksums[key]) {
                throw new Error(key.toUpperCase() + " checksum mismatch");
            }
        }
        var dir = packages.install(archivePath, descriptor.name, descriptor.version);
        term.writeln("Installed", descriptor.name,
                descriptor.version, "in", fs.resolve(dir));
    } finally {
        // cleanup: remove temporary package archive file
        if (archivePath !== null && fs.exists(archivePath)) {
            fs.remove(archivePath);
        }
    }
};

var activatePackage = function(descriptor) {
    var link = packages.activate(descriptor.name, descriptor.version);
    term.writeln("Activated", descriptor.name,
            descriptor.version, "in", fs.resolve(link));
};
