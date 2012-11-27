var fs = require("fs");
var term = require("ringo/term");
var {Parser} = require("ringo/args");
var packages = require("../utils/packages");
var {indent} = require("../utils/strings");
var descriptors = require("../utils/descriptors");

// argument parser
var parser = new Parser();
parser.addOption("g", "global", null, "List global packages");
parser.addOption("v", "verbose", null, "Display extensive information");

exports.description = "Lists installed packages";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp list [options]");
    term.writeln("\nOptions:");
    term.writeln(parser.help());
    term.writeln();
    return;
};

exports.list = function(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }
    var dir = (opts.global) ? packages.getGlobalDir() : packages.getLocalDir();
    list(dir, opts.verbose);
    term.writeln();
    return;
};

function getPackageDirectories(dir) {
    return fs.list(dir).filter(function(name) {
        var dest = fs.join(dir, name);
        return name.charAt(0) !== "." &&
                (fs.isDirectory(dest) || fs.isLink(dest)) &&
                fs.exists(fs.join(dest, packages.PACKAGE_JSON));
    }).map(function(name) {
        return fs.join(dir, name);
    }).sort();
}


function list(dir, verbose, level) {
    level = level || 0;
    var descriptor = packages.getDescriptor(dir);
    if (descriptor !== null) {
        var dirName = fs.base(fs.canonical(dir));
        if (dirName === descriptor.name) {
            render(dir, descriptor, verbose, level);
        }
    }
    var packagesDir = packages.getPackagesDir(dir);
    if (fs.exists(packagesDir)) {
        var directories = getPackageDirectories(packagesDir);
        if (directories.length > 0) {
            term.writeln("\nInstalled in", indent(packagesDir, level) + ":");
            directories.forEach(function(dir) {
                list(dir, verbose, level + 1);
            });
        }
    }
}

function render(dir, descriptor, verbose, level) {
    level = level || 0;
    term.writeln(term.BOLD, indent(descriptor.name, level), term.RESET, "(v" +
            descriptor.version + ")", "-",
            descriptor.description || "(no description available)");
    if (verbose === true) {
        term.writeln(indent(dir, 1));
        var author = descriptors.getAuthor(descriptor);
        if (author !== null) {
            term.write(indent("Author: ", 1));
            term.writeln(author.name,
                    "<" + author.email + ">");
        }
        term.write(indent("Dependencies:", 1));
        if (descriptor.hasOwnProperty("dependencies")) {
            term.writeln();
            Object.keys(descriptor.dependencies).sort().forEach(function(depName) {
                term.writeln(indent(2), "->", depName, descriptor.dependencies[depName]);
            });
        } else {
            term.writeln(" none");
        }
    }
};