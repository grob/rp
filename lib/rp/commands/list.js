var fs = require("fs");
var term = require("ringo/term");
var {Parser} = require("ringo/args");

// argument parser
var parser = new Parser();
parser.addOption("i", "installed", null, "List installed packages");
parser.addOption("a", "available", null, "List active packages");
parser.addOption("v", "verbose", null, "Display extensive information");

exports.list = function list(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }
    if (opts.installed === true) {
        term.writeln("\nInstalled packages:\n");
        listPackages(getInstallDir(), opts.verbose);
    } else {
        term.writeln("\nActive packages:\n");
        listPackages(getPackagesDir(), opts.verbose);
    }
    term.writeln();
    return;
};

exports.help = function help() {
    term.writeln("\nLists installed or active packages.\n");
    term.writeln("Usage:");
    term.writeln("  rp list [options]");
    term.writeln("\nOptions:");
    term.writeln(parser.help());
    term.writeln();
    return;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  list", term.RESET, "-", "Lists installed or active packages");
};

function getPackagesDir() {
    return fs.resolve(system.prefix, "packages");
}

function getInstallDir() {
    return fs.resolve(system.prefix, "packages.available");
}

function getPackageList(dir) {
    return fs.list(dir).filter(function(name) {
        return name.charAt(0) !== ".";
    }).sort();
}

function listPackages(dir, verbose) {
    getPackageList(dir).forEach(function(name) {
        var jsonPath = fs.join(dir, name, "package.json");
        if (fs.exists(jsonPath)) {
            var descriptor = JSON.parse(fs.read(jsonPath));
            term.writeln(" ", term.BOLD, descriptor.name, term.RESET,
                    "(v" + descriptor.version + ")", "-",
                    descriptor.description || "(no description available)");
            if (verbose === true) {
                descriptor.author && term.writeln("    Author:", descriptor.author);
                descriptor.keywords && term.writeln("    Keywords:", descriptor.keywords.join(" "));
                if (descriptor.hasOwnProperty("dependencies")) {
                    term.writeln("    Dependencies:");
                    Object.keys(descriptor.dependencies).sort().forEach(function(depName) {
                        term.writeln("     ", depName, descriptor.dependencies[depName]);
                    });
                }
            }
        }
    });
}
