var fs = require("fs");
var term = require("ringo/term");

exports.description = "Display available commands";

exports.help = function help([name]) {
    if (name != null) {
        try {
            require("./" + name).help();
        } catch (e if e instanceof InternalError) {
            term.writeln(term.RED, "Unknown command '" + name +
                    "', use 'help' to get a list of available commands",
                    term.RESET);
            return false;
        }
    } else {
        // print short info about available modules
        term.writeln();
        term.writeln(term.GREEN, "Available commands:", term.RESET);
        fs.list(module.directory).sort().forEach(function(file) {
            var cmd = file.slice(0, fs.extension(file).length * -1);
            var desc = require(module.resolve(file)).description;
            term.writeln(term.BOLD, " ", cmd, term.RESET, "-", desc);
        });
        term.writeln();
    }
    return true;
};
