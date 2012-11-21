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

    var dir = (opts.global === true) ?
            packages.getGlobalDir() : packages.getLocalDir();
    var packagesDir = packages.getPackagesDir(dir);
    var descriptor = packages.getDescriptor(dir);
    var resolver;
    if (descriptor !== null && descriptor.hasOwnProperty("dependencies")) {
        resolver = new Resolver(registry);
        if (args.length === 0) {
            term.writeln("Searching for updates of", descriptor.name, "dependencies ...");
            for each (let [name, range] in Iterator(descriptor.dependencies)) {
               resolver.resolve(name, range);
            }
        } else {
            term.writeln("Searching for updates of", args.join(", "), "...");
            for each (let name in args) {
                let range = descriptor.dependencies[name];
                if (!range) {
                    term.writeln(name, "is not a dependency of", descriptor.name);
                    continue;
                }
                resolver.resolve(name, range);
            }
        }
    } else {
        term.writeln("Searching for updates of packages in", packagesDir, "...");
        resolver = resolvePackages(packagesDir, getInstalled(packagesDir), args);
    }
    var [toInstall, upToDate] = checkResolvedPackages(packagesDir,
            resolver.getDescriptors());
    for each (let d in upToDate) {
        term.writeln(indent(d.name, 1), d.version, "is the latest version");
    }
    if (toInstall.length > 0) {
        installPackages(packagesDir, toInstall);
    }
};

var getInstalled = function(packagesDir) {
    var list = fs.list(packagesDir);
    var installed = [];
    for each (let dirName in list) {
        let dir = fs.join(packagesDir, dirName);
        log.debug("Checking", dir, "...");
        if (fs.isFile(dir)) {
            log.debug(dir, "is a file, ignoring");
            continue;
        }
        var descriptor = packages.getDescriptor(dir);
        if (!descriptor) {
            log.debug("doesn't contain a package descriptor, ignoring");
        } else if (descriptor.name !== dirName) {
            log.debug("contains", descriptor.name, descriptor.version +
                    ", ignoring");
        } else {
            installed.push(descriptor);
            log.debug("Added", descriptor.name, "(" + dir +
                    ") to the list of installed packages");
        }
    }
    return installed;
};

var resolvePackages = function(packagesDir, installed, packageNames) {
    log.debug("Resolving installed packages in", packagesDir);
    if (packageNames.length > 0) {
        log.debug("Limit to", packageNames.join(", "));
    }
    var resolver = new Resolver(registry);
    for each (let descriptor in installed) {
        if (packageNames.length > 0 && packageNames.indexOf(descriptor.name) < 0) {
            continue;
        }
        log.debug("Resolving", descriptor.name, descriptor.version);
        resolver.resolve(descriptor.name);
    }
    return resolver;
};

var checkResolvedPackages = function(packagesDir, descriptors) {
    var toInstall = [];
    var upToDate = [];
    log.debug("Checking resolved packages in", packagesDir);
    for each (let resolved in descriptors) {
        log.debug("Checking package", resolved.name);
        let dir = fs.join(packagesDir, resolved.name);
        if (!fs.exists(dir)) {
            log.debug("Package", resolved.name, "can be safely installed");
            toInstall.push(resolved);
        } else if (fs.isFile(dir)) {
            throw new Error("Can't install " + resolved.name +
                    " because a file with the same name exists in " + packagesDir);
        } else {
            let current = packages.getDescriptor(dir);
            if (!current) {
                throw new Error("Can't install " + resolved.name +
                        " because a directory with the same name exists in " +
                        packagesDir + ", but doesn't contain a valid package");
            }
            if (semver.isGreater(resolved.version, current.version)) {
                if (fs.isLink(dir)) {
                    throw new Error("Can't install " + resolved.name +
                            " because a symbolic link with the same exists in" +
                            packagesDir);
                }
                log.debug("Package", resolved.name, "can be updated from",
                        current.version, "to", resolved.version);
                toInstall.push(resolved);
            } else {
                log.debug("Package", current.name, "is already the latest version");
                upToDate.push(current);
            }
        }
    }
    return [toInstall, upToDate];
};

var installPackages = function(packagesDir, descriptors) {
    term.writeln("\nAbout to update/install the following package(s):");
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
