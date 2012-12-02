var fs = require("fs");
var term = require("ringo/term");
var semver = require("../utils/semver");
var packages = require("../utils/packages");
var shell = require("ringo/shell");
var {Parser} = require("ringo/args");
var {indent} = require("../utils/strings");

// argument parser
var parser = new Parser();
parser.addOption("g", "global", null, "Uninstall global package");

exports.description = "Uninstalls a package";

var help = exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp uninstall <name>\n");
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
    var dir = packages.getPackagesDir((opts.global === true) ?
            packages.getGlobalDir() : packages.getLocalDir());
    var name = args.shift();
    if (!name) {
        return help();
    } else if (!packages.isInstalled(dir, name)) {
        throw new Error("The package " + name + " isn't installed. Maybe a typo?");
    }
    var pkgDir = fs.join(dir, name);
    var descriptor = packages.getDescriptor(pkgDir);
    if (!descriptor || descriptor.name !== name) {
        throw new Error("Directory " + pkgDir +
                " exists, but doesn't contain the package " + name);
    }
    term.writeln("\nAbout to uninstall the package");
    term.writeln(indent(1), name, descriptor.version, "(" + pkgDir + ")");
    if (!confirm("\nDo you want to continue?")) {
        return false;
    }
    packages.uninstall(dir, name);
    term.writeln(term.GREEN, "Uninstalled", name, term.RESET);
};

var confirm = function(msg) {
    var proceed = shell.readln(msg + " (y/N) ");
    if (proceed.toLowerCase() != "y") {
        term.writeln("Cancelled");
        return false;
    }
    return true;
};
