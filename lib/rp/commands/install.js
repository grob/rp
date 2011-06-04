var config = require("../config");
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
    
    var descriptor = registry.getPackageDetails(packageName, version);
    var pkgList = resolveDependencies(descriptor);
    if (pkgList.length > 1) {
        // ask for confirmation to install dependent packages too
        term.writeln("\nAbout to install and activate the following packages:");
        for each (var pkg in pkgList) {
            term.writeln("  ", pkg.name, pkg.version);
        }
        var confirmation = shell.readln("\nDo you want to proceed? (Y/n) ");
        if (confirmation != "" && confirmation != "y") {
            term.writeln("\nAborted");
            return false;
        }
    }
    for each (let pkgDescriptor in pkgList) {
        var archivePath = null;
        try {
            if (!packages.isInstalled(pkgDescriptor.name, pkgDescriptor.version)) {
                archivePath = fetchPackage(pkgDescriptor);
                var dir = packages.install(archivePath, pkgDescriptor.name, pkgDescriptor.version);
                term.writeln("Installed", pkgDescriptor.name,
                        pkgDescriptor.version, "in", fs.resolve(dir));
                
            } else {
                term.writeln("Package", pkgDescriptor.name, pkgDescriptor.version,
                        "is already installed");
            }
            if (!packages.isActivated(pkgDescriptor.name)) {
                var link = packages.activate(pkgDescriptor.name, pkgDescriptor.version);
                term.writeln("Activated", pkgDescriptor.name,
                        pkgDescriptor.version, "in", fs.resolve(link));
            } else {
                term.writeln("Package", pkgDescriptor.name, pkgDescriptor.version,
                "is already activated");
            }
        } catch (e) {
            term.writeln(term.RED, e.message, term.RESET);
            if (archivePath !== null && fs.exists(archivePath)) {
                fs.remove(archivePath);
            }
            return false;
        }
    }
    term.writeln(term.GREEN, "Finished", term.RESET);
    return true;
};

function resolveDependencies(descriptor) {
    var arr = [descriptor];
    if (descriptor.dependencies != undefined) {
        var names = Object.keys(descriptor.dependencies).sort();
        for each (var name in names) {
            var version = descriptor.dependencies[name];
            arr.push(registry.getPackageDetails(name, version));
        };
    }
    return arr;
}

function fetchPackage(descriptor) {
    var url = httpclient.composeUrl(config.registry.url, descriptor.filename);
    log.debug("Retrieving package " + url);
    return httpclient.getBinary(url);
}

