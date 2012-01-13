var term = require("ringo/term");
var shell = require("ringo/shell");
var registry = require("../utils/registry");

exports.description = "Creates a registry account";

exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp createuser\n");
    return;
};

exports.createuser = function() {
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
        term.writeln("\n", term.GREEN, response.message, term.RESET);
    }
    return;
};
