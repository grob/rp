var term = require("ringo/term");
var shell = require("ringo/shell");
var strings = require("ringo/utils/strings");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");

exports.description = "Lists and manages package owners";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp owner <package>");
    term.writeln("  rp owner <package> add <owner>");
    term.writeln("  rp owner <package> remove <owner>");
    term.writeln();
    return;
};

exports.owner = function([pkgName, action, ownerName]) {
    if (!pkgName) {
        throw new Error("Please specify the name of the package");
    }
    if (!registry.exists(pkgName)) {
        throw new Error("Package '" + pkgName + "' does not exist in registry");
    }
    if (!action || action === "list") {
        listOwners(pkgName);
    } else if (action === "add" || action === "remove") {
        if (!ownerName) {
            throw new Error("Please specify the name of the owner to add");
        } else if (!registry.userExists(ownerName)) {
            throw new Error("Unknown user " + ownerName);
        }
        var username, salt;
        while (!username || !salt) {
            username = shell.readln("Username: ").trim();
            if (username.length > 0) {
                salt = registry.getSalt(username);
                if (salt === null) {
                    term.writeln(term.RED, "Unknown user", username, term.RESET);
                }
            }
        }
        var digest = crypto.createDigest(shell.readln("Password: ", "*"),
                strings.b64decode(salt, "raw"));
        var password = strings.b64encode(digest);
        var response = registry[action + "Owner"](username, password,
                pkgName, ownerName);
        term.writeln(term.GREEN, response.message, term.RESET);
    } else {
        term.writeln(term.RED, "\nUnknown command '" + action + "'", term.RESET);
        exports.help();
    }
};

var listOwners = function(pkgName) {
    var owners = registry.getPackageOwners(pkgName);
    term.writeln("\nOwners of", pkgName + ":");
    for each (let owner in owners) {
        term.writeln("  ", owner.name, "(" + owner.email + ")");
    }
    term.writeln();
};
