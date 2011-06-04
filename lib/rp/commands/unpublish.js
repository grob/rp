var log = require("ringo/logging").getLogger(module.id);
var {Parser} = require("ringo/args");
var config = require("../config");
var term = require("ringo/term");
var shell = require("ringo/shell");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");
var strings = require("ringo/utils/strings");

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
    var username, salt;
    while (!username || !salt) {
        username = shell.readln("Username: ");
        salt = registry.getSalt(username);
        if (!salt) {
            term.writeln(term.RED, "Unknown user", username, term.RESET);
        }
    }
    var digest = crypto.createDigest(shell.readln("Password: ", "*"),
            strings.b64decode(salt, "raw"));
    var password = strings.b64encode(digest);
    var response = registry.unpublish(username, password, name, version);
    if (response === null) {
        print(term.RED, "Unable to contact registry, please try again later", term.RESET);
    } else {
        term.writeln(term.RED, JSON.parse(response).message, term.RESET);
    }
    return;
};

