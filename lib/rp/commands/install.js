var term = require("ringo/term");
var shell = require("ringo/shell");
var fs = require("fs");
var semver = require("../utils/semver");
var registry = require("../utils/registry");
var packages = require("../utils/packages");
var {activatePackage} = require("./activate");
var {Resolver} = require("../utils/resolver");

exports.description = "Install a new package";

exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp install <name> [version]\n");
    return true;
};

exports.install = function([name, version]) {
    if (!name) {
        throw new Error("Please specify the name of the package to install");
    } else if (version != null) {
        version = semver.cleanVersion(version);
    }

    // check if package exists in registry
    if (!registry.exists(name)) {
        throw new Error("Package '" + name + "' does not exist in registry");
    } else if (version && !registry.exists(name, version)) {
        throw new Error("Version " + version + " of package " + name + " does not exist in registry");
    }

    var resolver = new Resolver(registry);
    resolver.resolve(name, version);
    var pkgList = resolver.getDescriptors();
    if (installPackages(pkgList) && activatePackages(pkgList)) {
        term.writeln(term.GREEN, "Finished", term.RESET);
    }
};

var installPackages = function(list) {
    var installed = [pkg for each (pkg in list)
            if (packages.isInstalled(pkg.name, pkg.version))];
    for each (let {name, version} in installed) {
        term.writeln(name, version, "is already installed");
    }
    var toInstall = [pkg for each (pkg in list)
            if (installed.indexOf(pkg) < 0)];
    if (toInstall.length > 0) {
        term.writeln("\nAbout to", term.BOLD, "install", term.RESET,
                "the following packages:");
        for each (let {name, version} in toInstall) {
            term.writeln("  ", name, version);
        }
        var proceed = shell.readln("\nDo you want to proceed? (Y/n) ");
        if (proceed.length > 0 && proceed.toLowerCase() != "y") {
            term.writeln("Cancelled");
            return false;
        }
        toInstall.forEach(installPackage);
    }
    return true;
};

var activatePackages = function(list) {
    var activated = [pkg for each (pkg in list)
        if (packages.isActivated(pkg.name, pkg.version))];
    for each (let {name, version} in activated) {
        term.writeln(name, version, "is already activated");
    }
    var toActivate = [pkg for each (pkg in list)
            if (activated.indexOf(pkg) < 0)];
    if (toActivate.length > 0) {
        return toActivate.every(function({name, version}) {
            return activatePackage(name, version);
        });
    }
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
        packages.install(archivePath, descriptor.name, descriptor.version);
        term.writeln(term.GREEN, "Installed", descriptor.name, descriptor.version, term.RESET);
    } finally {
        // cleanup: remove temporary package archive file
        if (archivePath !== null && fs.exists(archivePath)) {
            fs.remove(archivePath);
        }
    }
};
