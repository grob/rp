var term = require("ringo/term");
var {Parser} = require("ringo/args");

require("ringo/logging").setConfig(getResource("./log4j.properties"));

function main(args) {
    var cmd = args.shift() || "help";
    var module = null;
    try {
        module = require("./commands/" + cmd);
    } catch (e) {
        term.writeln(term.RED, "Unknown command '" + cmd +
                "', use 'help' to get a list of available commands",
                term.RESET);
        return false;
    }
    module[cmd](args);
    return;
}

if (require.main == module.id) {
    // call main, stripping the module location from args
    main(system.args.splice(1));
}