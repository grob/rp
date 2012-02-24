var fs = require("fs");
var term = require("ringo/term");
var shell = require("ringo/shell");
var {Parser} = require("ringo/args");
var semver = require("../utils/semver");
var packages = require("../utils/packages");
var registry = require("../utils/registry");
var {Resolver} = require("../utils/resolver");

const MISSING = -99;
const UNMANAGED = -1;
const UPTODATE = 0;

//argument parser
var parser = new Parser();
parser.addOption("a", "activated", null, "Update activated packages (default)");
parser.addOption("i", "installed", null, "Update installed packages");

exports.description = "Updates installed packages";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp update [options]");
    term.writeln("\nOptions:");
    term.writeln(parser.help());
    term.writeln();
    return;
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
    var current = packages[(opts.installed === true) ?
            "getLatestInstalledVersions" : "getActivatedVersions"]();
    var count = Object.keys(current).length;
    term.writeln("\nChecking for updates of", count,
            (opts.installed === true) ? "installed" : "activated",
            "package(s)...");
    var findings = checkPackages(current);
    var toInstall = [];
    for (let [name, resolved] in Iterator(findings)) {
        switch (resolved) {
            case MISSING:
                term.writeln(term.YELLOW, "   Missing:", name, "doesn't exist in registry", term.RESET);
                break;
            case UNMANAGED:
                term.writeln(term.YELLOW, "   Skipped:", name, "is not managed by rp", term.RESET);
                break;
            case UPTODATE:
                term.writeln("   Up-to-date:", name, current[name], term.RESET);
                break;
            default:
                toInstall.push(resolved);
        }
    };
    if (toInstall.length < 1) {
        term.writeln(term.GREEN, "\nAll packages are up-to-date", term.RESET);
    } else {
        term.writeln("\nAbout to update/install the following packages:");
        for each (let descriptor in toInstall) {
            let installedVersion = current[descriptor.name];
            if (installedVersion != null) {
                term.writeln("  ", descriptor.name, "(" + installedVersion, "->",
                        descriptor.version + ")");
            } else {
                term.writeln("  ", descriptor.name, descriptor.version);
            }
        }
        var proceed = shell.readln("\nDo you want to proceed? (y/N) ");
        if (proceed.length < 1 || proceed.toLowerCase() != "y") {
            term.writeln("Cancelled");
            return false;
        }
        toInstall.forEach(installPackage);
        if (opts.activated === true) {
            toInstall.forEach(activatePackage);
        }
        term.writeln(term.GREEN, "Finished", term.RESET);
    }
    return;
};

var checkPackages = function(current) {
    var result = {};
    var resolver = new Resolver(registry);
    for (let name in current) {
        if (!registry.exists(name)) {
            result[name] = MISSING;
        } else if (!packages.isManaged(fs.join(packages.getPackagesDir(), name))) {
            result[name] = UNMANAGED;
        } else {
            resolver.resolve(name);
        }
    }
    for each (let descriptor in resolver.getDescriptors()) {
        let installed = current[descriptor.name];
        if (installed) {
            if (!packages.isManaged(fs.join(packages.getPackagesDir(), descriptor.name))) {
                result[descriptor.name] = UNMANAGED;
                continue;
            } else if (!semver.isGreater(descriptor.version, installed)) {
                result[descriptor.name] = (result[descriptor.name] || UPTODATE);
                continue;
            }
        }
        result[descriptor.name] = descriptor;
    }
    return result;
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

var activatePackage = function(descriptor) {
    if (packages.isActivated(descriptor.name)) {
        packages.deactivate(descriptor.name);
    }
    packages.activate(descriptor.name, descriptor.version);
};