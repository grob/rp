var term = require("ringo/term");
var cache = require("../utils/cache");

exports.description = "Manage the local registry catalog cache";

exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp cache [update|init]\n");
    return true;
};

exports.cache = function([action]) {
    if (!action || action === "update") {
        updateCache();
    } else if (action === "init") {
        initCache();
    } else {
        throw new Error("Invalid argument '" + action + "'");
    }
};

var updateCache = function() {
    term.write("\nRetrieving package catalog updates ... ");
    cache.update();
    term.writeln(term.GREEN, term.BOLD, "done\n", term.RESET);
};

var initCache = function() {
    term.write("\nInitializing package catalog ... ");
    cache.init();
    term.writeln(term.GREEN, term.BOLD, "done\n", term.RESET);
};
