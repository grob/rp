var log = require("ringo/logging").getLogger(module.id);
var term = require("ringo/term");
var shell = require("ringo/shell");
var registry = require("../utils/registry");

exports.createuser = function list(args) {
    term.writeln("\nYou need to choose a username, password and email address to create a registry account.\n");
    var username, pwd, pwdConfirm, email;
    while (!username) {
        username = shell.readln("Username: ").trim();
        if (registry.userExists(username)) {
            term.writeln("This username is already registered, please choose another one");
            username = null;
        }
    }
    while (!pwd || (pwd !== pwdConfirm)) {
        pwd = shell.readln("Password: ", "*");
        pwdConfirm = shell.readln("Confirm password: ", "*");
        if (pwd !== pwdConfirm) {
            term.writeln(term.BOLD, "\nPasswords do not match, please try again.\n", term.RESET);
        }
    }
    var email = shell.readln("Email: ");
    term.writeln("\nA registry account will be created using the following information:\n");
    term.writeln("  Username:", term.BOLD, username, term.RESET);
    term.writeln("  Email:", term.BOLD, email, term.RESET);
    var proceed = shell.readln("\nDo you want to proceed? (Y/n) ");
    if (proceed.length > 0 && proceed.toLowerCase() != "y") {
        term.writeln("\nAborted");
    }
    var response = registry.createUser(username, pwd, email);
    if (response !== null) {
        term.writeln("\n", response.message);
    }
    return;
};

exports.help = function help() {
    term.writeln("\nCreates a new registry account.\n");
    term.writeln("Usage:");
    term.writeln("  rp createuser");
    return;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  createuser", term.RESET, "-", "Creates a registry account");
};
