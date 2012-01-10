var fs = require("fs");
var term = require("ringo/term");

exports.help = function help(args) {
    if (args.length == 1) {
        var name = args.shift();
        try {
            require("./" + name).help(args);
        } catch (e if e instanceof InternalError) {
            term.writeln(term.RED, "Unknown command '" + name +
                    "', use 'help' to get a list of available commands",
                    term.RESET);
            return false;
        }
    } else {
        // print short info about available modules
        term.writeln(term.GREEN, "Available commands:", term.RESET);
        fs.list(module.directory).sort().forEach(function(file) {
            require(module.resolve(file)).info();
        });
    }
    return true;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  help", term.RESET, "-", "Display available commands");
    return;
};
