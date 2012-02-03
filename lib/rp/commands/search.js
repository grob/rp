var term = require("ringo/term");
var registry = require("../utils/registry");
var dates = require("ringo/utils/dates");
var {Parser} = require("ringo/args");
var descriptors = require("../utils/descriptors");

//argument parser
var parser = new Parser();
parser.addOption("v", "verbose", null, "Display extensive information");

exports.description = "Search for packages in registry";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp search [keyword ...]\n");
    return;
};

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

function searchPackages(args, verbose) {
    var result = registry.search(args.join(" "));
    if (result.total > 0) {
        term.writeln();
        for each (var descriptor in result.hits) {
            var modified = dates.parse(descriptor.versions[0].modified, "yyyy-MM-dd'T'HH:mm:ss.S'Z'");
            term.writeln(" ", term.BOLD, descriptor.name, term.RESET,
                     "-", descriptor.description || "(no description available)");
            if (verbose === true) {
                term.writeln("    Version:", descriptor.latest);
                term.writeln("    Author:", descriptor.author.name);
                term.writeln("    Last update:", dates.format(modified, "EEEE dd.MM.yyyy, HH:mm"));
                if (descriptors.hasEngineDependency(descriptor)) {
                    term.writeln("    RingoJS version:", descriptor.engines.ringojs);
                }
                if (descriptor.hasOwnProperty("dependencies")) {
                    term.writeln("    Dependencies:");
                    Object.keys(descriptor.dependencies).sort().forEach(function(depName) {
                        term.writeln("     ", depName, descriptor.dependencies[depName]);
                    });
                }
                term.writeln();
            }
        };
        if (!verbose) {
            term.writeln();
        }
    } else {
        term.writeln("\nNo packages found\n");
    }
    return;
}
