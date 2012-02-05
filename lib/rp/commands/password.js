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
    term.writeln("To reset your registry password use:");
    term.writeln("  rp password reset\n");
    term.writeln("You'll receive an email with instructions on how to reset your password.");
    return;
};

exports.password = function([action]) {
    var username, salt;
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
    var response;
    if (action === "reset") {
        var email;
        while (!email) {
            email = shell.readln("Email: ").trim();
        }
        response = registry.initPasswordReset(username, email);
    } else if (action === "set") {
        var token, password, pwdConfirm;
        while (!token) {
            token = shell.readln("Password reset token: ").trim();
        }
        while (!password) {
            password = shell.readln("New password: ", "*").trim()
            pwdConfirm = shell.readln("Confirm new password: ", "*");
            if (password !== pwdConfirm) {
                term.writeln(term.BOLD, "\nPasswords do not match, please try again.\n", term.RESET);
                password = pwdConfirm = null;
            }
        }
        response = resetPassword(username, salt, token, password);
    } else {
        var oldPwd = shell.readln("Old password: ", "*");
        var newPwd, newPwdConfirm;
        while (!newPwd) {
            newPwd = shell.readln("New password: ", "*");
            newPwdConfirm = shell.readln("Confirm new password: ", "*");
            if (newPwd !== newPwdConfirm) {
                term.writeln(term.BOLD, "\nPasswords do not match, please try again.\n", term.RESET);
                newPwd = newPwdConfirm = null;
            }
        }
        response = setPassword(username, salt, oldPwd, newPwd);
    }
    term.writeln(term.GREEN, response.message, term.RESET);
    return;
};

var setPassword = function(username, salt, oldPwd, newPwd) {
    var saltBytes = strings.b64decode(salt, "raw");
    var oldDigest = crypto.createDigest(oldPwd, saltBytes);
    var newDigest = crypto.createDigest(newPwd, saltBytes);
    return registry.changePassword(username,
            strings.b64encode(oldDigest),
            strings.b64encode(newDigest));
};

var resetPassword = function(username, salt, token, password) {
    var saltBytes = strings.b64decode(salt, "raw");
    var digest = crypto.createDigest(password, saltBytes);
    return registry.resetPassword(username, token,
            strings.b64encode(digest));
};
