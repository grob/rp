var term = require("ringo/term");
var shell = require("ringo/shell");
var strings = require("ringo/utils/strings");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");

exports.description = "Change registry account email address";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp email\n");
};

exports.email = function() {
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
    var email;
    while (!email) {
        email = shell.readln("Email address: ").trim();
        if (email && !strings.isEmail(email)) {
            term.writeln(term.BOLD, "Invalid email address", term.RESET);
            email = null;
        }
    }
    var response = registry.changeEmail(username, password, email);
    term.writeln(term.GREEN, response.message, term.RESET);
};
