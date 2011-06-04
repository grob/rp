var term = require("ringo/term");
var registry = require("../utils/registry");
var dates = require("ringo/utils/dates");
var {Parser} = require("ringo/args");

//argument parser
var parser = new Parser();
parser.addOption("v", "verbose", null, "Display extensive information");

exports.search = function search(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }
    searchPackages(args, opts.verbose === true);
    return;
};

exports.help = function help() {
    term.writeln("\nSearch for packages in registry\n");
    term.writeln("Usage:");
    term.writeln("  rp search [keyword ...]");
    term.writeln();
    return;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  search", term.RESET, "-", "Search for packages in registry");
};

function searchPackages(args, verbose) {
    Object.keys(registry.packages || []).sort().forEach(function(name) {
        var descriptor = registry.packages[name];
        var modifytime = dates.parse(descriptor.modified[descriptor.latest], "yyyy-MM-dd'T'HH:mm:ss.S'Z'");
        term.writeln(" ", term.BOLD, descriptor.name, term.RESET,
                 "-", descriptor.description || "(no description available)");
        if (verbose === true) {
            term.writeln("    Version:", descriptor.latest);
            term.writeln("    Author:", descriptor.author.name);
            term.writeln("    Last update:", dates.format(modifytime, "EEEE dd.MM.yyyy, HH:mm"));
            if (descriptor.hasOwnProperty("dependencies")) {
                term.writeln("    Dependencies:");
                Object.keys(descriptor.dependencies).sort().forEach(function(depName) {
                    term.writeln("     ", depName, descriptor.dependencies[depName]);
                });
            }
        }
    });
    return;
}