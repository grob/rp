var log = require("ringo/logging").getLogger(module.id);
var {Parser} = require("ringo/args");
var config = require("../config");
var term = require("ringo/term");
var httpclient = require("../utils/httpclient");

exports.help = function help() {
    term.writeln("\nRemoves a published package in the registry.\n");
    term.writeln("Usage:");
    term.writeln("  rp unpublish <name> <version>");
    return;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  unpublish", term.RESET, "-", "Removes a published package in the registry");
    return;
};

exports.unpublish = function(args) {
    var [name, version] = args;
    if (!name) {
        term.writeln(term.RED, "Please specify the name of the package to unpublish", term.RESET);
        return;
    } else if (!version) {
        term.writeln(term.RED, "Please specify the version to unpublish", term.RESET);
        return;
    }
    
    return;
};

