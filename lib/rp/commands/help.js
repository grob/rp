var fs = require("fs");
var term = require("ringo/term");

exports.help = function help(args) {
    if (args.length == 1) {
        var name = args.shift();
        var cmd = require("./" + name);
        cmd.help(args);
    } else {
        // print short info about available modules
        term.writeln(term.GREEN, "Available commands:", term.RESET);
        fs.list(module.directory).sort().forEach(function(file) {
            require(module.resolve(file)).info();
        });
        return;
    }
    return;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  help", term.RESET, "-", "Display available commands");
    return;
};
