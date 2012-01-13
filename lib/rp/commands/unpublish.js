var {Parser} = require("ringo/args");
var term = require("ringo/term");
var shell = require("ringo/shell");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");
var strings = require("ringo/utils/strings");
var semver = require("ringo-semver");

exports.description = "Removes a published package in the registry";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp unpublish <name> [version]\n");
    return;
};

exports.unpublish = function([packageName, version]) {
    if (!packageName) {
        throw new Error("Please specify the name of the package to unpublish");
    } else if (version != null) {
        version = semver.cleanVersion(version);
    }
    // check if package exists in registry
    if (!registry.exists(packageName)) {
        throw new Error("Package '" + packageName + "' does not exist in registry");
    } else if (version && !registry.exists(packageName, version)) {
        throw new Error("Version " + version + " of package " + packageName + " does not exist in registry");
    }

    var username, salt;
    while (!username || !salt) {
        username = shell.readln("Username: ");
        salt = registry.getSalt(username);
        if (!salt) {
            throw new Error("Unknown user '" + username + "'");
        }
    }
    var digest = crypto.createDigest(shell.readln("Password: ", "*"),
            strings.b64decode(salt, "raw"));
    var password = strings.b64encode(digest);
    var response = registry.unpublish(username, password, packageName, version);
    term.writeln(term.GREEN, JSON.parse(response).message, term.RESET);
    return;
};

