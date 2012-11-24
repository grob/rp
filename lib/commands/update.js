var fs = require("fs");
var term = require("ringo/term");
var shell = require("ringo/shell");
var {Parser} = require("ringo/args");
var semver = require("../utils/semver");
var packages = require("../utils/packages");
var registry = require("../utils/registry");
var {Resolver, Resolved} = require("../utils/resolver");
var {indent} = require("../utils/strings");
var log = require("ringo/logging").getLogger(module.id);

//argument parser
var parser = new Parser();
parser.addOption("g", "global", null, "Update globally installed packages");

exports.description = "Updates installed packages";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp update [options] [<name> [<name> ...]]");
    term.writeln("\nOptions:");
    term.writeln(parser.help());
    term.writeln();
};

exports.update = function(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }

    var dir = packages[(opts.global === true) ? "getGlobalDir" : "getLocalDir"]();
    var packagesDir = packages.getPackagesDir(dir);
    if (!fs.exists(packagesDir)) {
        log.debug(packagesDir, "does not exist");
        term.writeln("No packages found (wrong directory?)");
        return false;
    }
    log.debug("Updating packages in", packagesDir);
    var resolver = new Resolver(registry);
    var descriptor = packages.getDescriptor(dir);
    if (descriptor !== null && descriptor.hasOwnProperty("dependencies")) {
        term.writeln("Resolving dependencies of", descriptor.name, "...");
        for each (let [name, range] in Iterator(descriptor.dependencies)) {
            resolver.resolve(name, range);
        }
    } else {
        term.writeln("Resolving packages installed in", packagesDir, "...");
        for each (let name in getInstalled(packagesDir)) {
            // term.writeln(indent("found", 1), name, "...");
            resolver.resolve(name);
        }
    }
    var resolved = resolver.getDescriptors();
    if (args.length > 0) {
        log.debug("Reducing packages to:", args.join(", "));
        resolved = resolved.filter(function(descriptor) {
            return args.indexOf(descriptor.name) > -1;
        });
    }
    var toInstall = filterInstallable(packagesDir, resolved);
    if (toInstall.length > 0) {
        installPackages(packagesDir, toInstall);
    }
};

var getInstalled = function(packagesDir) {
    return fs.list(packagesDir).filter(function(name) {
        if (name.charAt(0) === ".") {
            log.debug("ignoring", name);
            return false;
        }
        let dir = fs.join(packagesDir, name);
        if (fs.isFile(dir)) {
            log.debug("ignoring", dir, "- it's a file");
            return false;
        }
        let descriptor = packages.getDescriptor(dir);
        if (!descriptor) {
            log.debug("ignoring", dir, "- doesn't containg a package descriptor");
            return false;
        } else if (descriptor.name !== name) {
            log.debug("ignoring", dir, "- it contains", descriptor.name,
                    descriptor.version);
            return false;
        }
        return true;
    });
};

var filterInstallable = function(packagesDir, descriptors) {
    if (descriptors.length < 1) {
        return descriptors;
    }
    log.debug("Filtering packages installable in", packagesDir);
    return descriptors.filter(function(candidate) {
        return isInstallable(packagesDir, candidate);
    });
};

var isInstallable = function(packagesDir, descriptor) {
    log.debug("Checking if", descriptor.name, "is installable in", packagesDir, "...");
    let dir = fs.join(packagesDir, descriptor.name);
    if (!fs.exists(dir)) {
        log.debug(descriptor.name, "can be installed");
        term.writeln(descriptor.name, "is not installed in", packagesDir);
        return true;
    } else if (fs.isFile(dir)) {
        log.debug(descriptor.name, "is a file");
        term.writeln(term.RED, "Can't update", descriptor.name,
                "because a file with the same name exists in", packagesDir, term.RESET);
    } else if (fs.isLink(dir)) {
        log.debug(descriptor.name, "is a symlink to", fs.readLink(dir));
        term.writeln(term.RED, "Can't update", descriptor.name,
                "because it's a symlink to", fs.absolute(fs.readLink(dir)));
    } else {
        let current = packages.getDescriptor(dir);
        if (!current) {
            log.debug(dir, "exists, but doesn't contain a package");
            term.writeln(term.RED, "Can't update", descriptor.name, "because",
                    dir, "exists but doesn't contain a valid package", term.RESET);
        } else if (semver.isGreater(descriptor.version, current.version)) {
            log.debug(descriptor.name, "can be updated (" + current.version,
                    "->", descriptor.version + ")");
            term.writeln(descriptor.name, "can be updated from",
                    current.version, "to", descriptor.version);
            return true;
        } else {
            log.debug(descriptor.name, "is up-to-date (" + current.version + ")");
            term.writeln(current.name, "is already the latest version");
        }
    }
    return false;
};

var installPackages = function(packagesDir, descriptors) {
    term.writeln(term.BOLD, "\nAbout to update/install in", packagesDir + ":",
            term.RESET);
    for each (let descriptor in descriptors) {
        let current = packages.getDescriptor(fs.join(packagesDir, descriptor.name));
        if (current === null) {
            term.writeln(indent(descriptor.name, 1), descriptor.version);
        } else {
            term.writeln(indent(descriptor.name, 1), "(" + current.version,
                    "->", descriptor.version + ")");
        }
    }
    var proceed = shell.readln("\nDo you want to proceed? (y/N) ");
    if (proceed.length < 1 || proceed.toLowerCase() != "y") {
        log.debug("Cancelled");
        term.writeln("Cancelled");
        return false;
    }
    descriptors.forEach(function(descriptor) {
        installPackage(packagesDir, descriptor);
    });
    term.writeln(term.GREEN, "Finished", term.RESET);
};

var installPackage = function(dir, descriptor) {
    var file = null;
    var tmpInstallDir = null;
    var installDir = fs.join(dir, descriptor.name);
    try {
        term.writeln("Downloading", descriptor.name, descriptor.version, "...");
        file = registry.getPackage(descriptor);
        tmpInstallDir = packages.install(file, dir, descriptor.name + ".tmp",
                descriptor.version);
        if (fs.exists(installDir)) {
            fs.removeTree(installDir);
        }
        fs.move(tmpInstallDir, installDir);
        log.debug("Moved", tmpInstallDir, "to", installDir);
        term.writeln(term.GREEN, "Installed", descriptor.name,
                descriptor.version, "in", installDir, term.RESET);
    } finally {
        // cleanup: remove temporary package archive file and the temporary
        // installation directory (if existing)
        if (file !== null && fs.exists(file)) {
            fs.remove(file);
        }
        if (tmpInstallDir !== null && fs.exists(tmpInstallDir)) {
            fs.removeTree(tmpInstallDir);
        }
    }
};
