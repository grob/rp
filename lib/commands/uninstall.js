var fs = require("fs");
var term = require("ringo/term");
var semver = require("../utils/semver");
var packages = require("../utils/packages");
var shell = require("ringo/shell");
var {Parser} = require("ringo/args");
var {indent} = require("../utils/strings");
var {proceed} = require("../utils/shell");
var log = require("ringo/logging").getLogger(module.id);

// argument parser
var parser = new Parser();
parser.addOption("g", "global", null, "Uninstall global package");

exports.description = "Uninstalls a package";

var help = exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp uninstall [options] <name> [<name> ...]\n");
    term.writeln("Options:");
    term.writeln(parser.help());
    term.writeln();
};

exports.uninstall = function(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }
    if (args.length < 1) {
        return help();
    }
    var dir = packages.getPackagesDir((opts.global === true) ?
            packages.getGlobalDir() : packages.getLocalDir());
    var names = filterUninstallable(dir, args);
    if (names.length > 0) {
        term.writeln(term.BOLD, "\nAbout to uninstall:", term.RESET);
        for each (let name in names) {
            let packageDir = fs.canonical(fs.join(dir, name));
            let version = packages.getInstalledVersion(dir, name);
            term.writeln(indent(1), name, version, "(" + packageDir + ")");
        }
        if (!proceed("n")) {
            term.writeln("Cancelled");
        } else {
            for each (let name in names) {
                let packageDir = packages.uninstall(dir, name);
                term.writeln(term.GREEN, "Uninstalled", name,
                        "(" + packageDir + ")", term.RESET);
                log.debug("Uninstalled", packageDir);
            }
        }
    }
};

var filterUninstallable = function(packagesDir, names) {
    return names.filter(function(name) {
        var result = packages.isUninstallable(packagesDir, name);
        if (result !== packages.OK) {
            var packageDir = fs.normal(fs.join(packagesDir, name));
            term.write(term.RED);
            if (result === packages.ERR_GONE) {
                term.write("The package", name, "isn't installed. Maybe a typo?");
            } else if (result === packages.ERR_ISFILE) {
                term.write("Can't uninstall", packageDir, "- it's a file!?");
            } else if (result === packages.ERR_ISLINK) {
                term.write("Can't uninstall", packageDir, "- it's a link to",
                        fs.canonical(fs.readLink(packageDir)));
            } else if (result === packages.ERR_NOPACKAGE) {
                term.write(packageDir, "does not contain the package", name);
            } else if (result === packages.ERR_RENAMED) {
                let descriptor = packages.getDescriptor(packageDir);
                term.writeln(packageDir, "contains", descriptor.name,
                        descriptor.version);
            }
            term.writeln(term.RESET);
        }
        return result === packages.OK;
    });
};