var term = require("ringo/term");
var shell = require("ringo/shell");
var strings = require("ringo/utils/strings");
var registry = require("../utils/registry");
var {proceed} = require("../utils/shell");

exports.description = "Creates a registry account";

exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp createuser\n");
};

exports.createuser = function() {
    term.writeln("\nYou need to choose a username, password and email address to create a registry account.\n");
    var username, pwd, pwdConfirm, email;
    while (!username) {
        username = shell.readln("Username: ").trim();
        if (username.length > 0) {
            if (registry.userExists(username)) {
                term.writeln(term.BOLD, "This username is already registered, please choose another one", term.RESET);
                username = null;
            }
        }
    }
    while (!pwd || (pwd !== pwdConfirm)) {
        pwd = shell.readln("Password: ", "*");
        pwdConfirm = shell.readln("Confirm password: ", "*");
        if (pwd !== pwdConfirm) {
            term.writeln(term.BOLD, "\nPasswords do not match, please try again.\n", term.RESET);
        }
    }
    while (!email) {
        email = shell.readln("Email address: ").trim();
        if (email && !strings.isEmail(email)) {
            term.writeln(term.BOLD, "Invalid email address", term.RESET);
            email = null;
        }
    }
    term.writeln("\nA registry account will be created using the following information:\n");
    term.writeln("  Username:", term.BOLD, username, term.RESET);
    term.writeln("  Email:", term.BOLD, email, term.RESET);
    if (!proceed("y")) {
        term.writeln("Cancelled");
    } else {
        var response = registry.createUser(username, pwd, email);
        term.writeln(term.GREEN, response.message, term.RESET);
    }
};
