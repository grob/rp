var log = require("ringo/logging").getLogger(module.id);
var term = require("ringo/term");
var shell = require("ringo/shell");
var strings = require("ringo/utils/strings");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");

exports.help = function help() {
    term.writeln("\nChanges the password of a registry account.\n");
    term.writeln("Usage:");
    term.writeln("  rp password\n");
    return;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  password", term.RESET, "-", "Change registry account password");
    return;
};

exports.password = function() {
    var username, salt, oldPwd, newPwd, newPwdConfirm;
    while (!username) {
        username = shell.readln("Username: ").trim();
        salt = registry.getSalt(username);
        if (salt === null) {
            term.writeln("Unknown user", username);
            username = salt = null;
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
    if (response !== null) {
        term.writeln("\n", response.message);
    }
    return;
};
