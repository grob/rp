var term = require("ringo/term");
var shell = require("ringo/shell");
var strings = require("ringo/utils/strings");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");

exports.description = "Change registry account password";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp password\n");
    return;
};

exports.password = function() {
    var username, salt, oldPwd, newPwd, newPwdConfirm;
    while (!username) {
        username = shell.readln("Username: ").trim();
        if (username.length > 0) {
            salt = registry.getSalt(username);
            if (salt === null) {
                term.writeln(term.RED, "Unknown user", username, term.RESET);
                username = salt = null;
            }
        }
    }
    var oldPwd = shell.readln("Old password: ", "*");
    while (!newPwd) {
        newPwd = shell.readln("New password: ", "*");
        newPwdConfirm = shell.readln("Confirm new password: ", "*");
        if (newPwd !== newPwdConfirm) {
            term.writeln(term.BOLD, "\nPasswords do not match, please try again.\n", term.RESET);
            newPwd = newPwdConfirm = null;
        }
    }
    var saltBytes = strings.b64decode(salt, "raw");
    var oldDigest = crypto.createDigest(oldPwd, saltBytes);
    var newDigest = crypto.createDigest(newPwd, saltBytes);
    var response = registry.changePassword(username,
            strings.b64encode(oldDigest),
            strings.b64encode(newDigest));
    term.writeln(term.GREEN, response.message, term.RESET);
    return;
};
