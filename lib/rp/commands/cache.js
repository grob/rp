var term = require("ringo/term");
var registry = require("../utils/registry");

exports.help = function() {
    term.writeln("\nManage the local registry catalog cache.\n");
    term.writeln("Usage:");
    term.writeln("  rp index");
    return true;
};

exports.info = function() {
    term.writeln(term.BOLD, "  cache", term.RESET, "-", "Manage the local registry catalog cache");
    return true;
};

exports.cache = function([action]) {
    if (!action || action === "update") {
        updateIndex();
    } else if (action === "init") {
        initIndex();
    } else {
        term.writeln(term.RED, "Invalid argument '" + action + "'");
    }
};

var updateIndex = function() {
    term.write("\nRetrieving package catalog updates ... ");
    try {
        registry.updateIndex();
        term.writeln(term.GREEN, term.BOLD, "done\n", term.RESET);
    } catch (e) {
        term.writeln(term.RED, term.BOLD, "ERROR\n", term.RESET);
    }
};

var initIndex = function() {
    term.write("\nInitializing package catalog ... ");
    try {
        registry.initIndex();
        term.writeln(term.GREEN, term.BOLD, "done\n", term.RESET);
    } catch (e) {
        term.writeln(term.RED, term.BOLD, "ERROR\n", term.RESET);
    }
};
