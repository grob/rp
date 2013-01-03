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
var {proceed} = require("../utils/shell");

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
    var descriptor = packages.getDescriptor(dir);
    var resolver;
    if (descriptor !== null && descriptor.hasOwnProperty("dependencies")) {
        term.writeln("Resolving dependencies of", descriptor.name, "...");
        resolver = resolvePackages(Object.keys(descriptor.dependencies),
            descriptor.dependencies);
    } else {
        term.writeln("Resolving packages installed in", packagesDir, "...");
        resolver = resolvePackages(getInstalled(packagesDir));
    }
    var resolved = resolver.getDescriptors();
    if (args.length > 0) {
        log.debug("Reducing packages to:", args.join(", "));
        resolved = resolved.filter(function(descriptor) {
            return args.indexOf(descriptor.name) > -1;
        });
    }
    var toInstall = filterUpdateable(packagesDir, resolved);
    if (toInstall.length > 0) {
        installPackages(packagesDir, toInstall);
    }
};

var resolvePackages = function(names, ranges) {
    var resolver = new Resolver(registry);
    ranges = ranges || {};
    for each (let name in names) {
        try {
            resolver.resolve(name, ranges[name]);
        } catch (e) {
            term.writeln(term.RED, e.message, term.RESET);
        }
    }
    return resolver;
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
        } else if (fs.isLink(dir)) {
            log.debug("ignoring", dir, "linking to", fs.readLink(dir));
            term.writeln(term.YELLOW, "Ignoring symlinked package", fs.base(dir), term.RESET);
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

var filterUpdateable = function(packagesDir, descriptors) {
    return descriptors.filter(function(descriptor) {
        var result = packages.isUpdateable(packagesDir, descriptor.name, descriptor.version);
        if (result !== packages.OK) {
            var packageDir = fs.normal(fs.join(packagesDir, descriptor.name));
            term.write(term.RED);
            if (result === packages.ERR_ISFILE) {
                term.write("Can't update", descriptor.name,
                        "because a file with the same name exists in", packagesDir);
            } else if (result === packages.ERR_ISLINK) {
                term.write("Can't update", descriptor.name, "- it's a symlink to",
                        fs.readLink(packageDir));
            } else if (result === packages.ERR_NOPACKAGE) {
                term.write(term.RED, "Can't update", descriptor.name, "because",
                        packageDir, "doesn't contain a valid package");
            } else if (result === packages.ERR_RENAMED) {
                let descriptor = packages.getDescriptor(packageDir);
                term.write(packageDir, "contains", descriptor.name,
                        descriptor.version);
            } else if (result === packages.ERR_SAMEVERSION) {
                let descriptor = packages.getDescriptor(packageDir);
                term.write(term.GREEN, descriptor.name,
                        "is already the latest version (" + descriptor.version + ")");
            }
            term.writeln(term.RESET);
        }
        return result === packages.OK;
    });
};

var installPackages = function(packagesDir, descriptors) {
    term.writeln(term.BOLD, "\nAbout to update/install in", packagesDir + ":",
            term.RESET);
    for each (let descriptor in descriptors) {
        let current = packages.getDescriptor(packagesDir, descriptor.name);
        if (current === null) {
            term.writeln(indent(descriptor.name, 1), descriptor.version);
        } else {
            term.writeln(indent(descriptor.name, 1), "(" + current.version,
                    "->", descriptor.version + ")");
        }
    }
    if (!proceed("n")) {
        term.writeln("Cancelled");
    } else {
        descriptors.forEach(function(descriptor) {
            installPackage(packagesDir, descriptor);
        });
    }
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
