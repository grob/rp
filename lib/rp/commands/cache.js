var term = require("ringo/term");
var registry = require("../utils/registry");

exports.description = "Manage the local registry catalog cache";

exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp cache [update|init]\n");
    return true;
};

exports.cache = function([action]) {
    if (!action || action === "update") {
        updateIndex();
    } else if (action === "init") {
        initIndex();
    } else {
        throw new Error("Invalid argument '" + action + "'");
    }
};

var updateIndex = function() {
    term.write("\nRetrieving package catalog updates ... ");
    registry.updateIndex();
    term.writeln(term.GREEN, term.BOLD, "done\n", term.RESET);
};

var initIndex = function() {
    term.write("\nInitializing package catalog ... ");
    registry.initIndex();
    term.writeln(term.GREEN, term.BOLD, "done\n", term.RESET);
};
