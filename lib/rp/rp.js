var {Parser} = require("ringo/args");

require("ringo/logging").setConfig(getResource("./log4j.properties"));

function main(args) {
    var cmd = args.shift() || "help";
    var module = require("./commands/" + cmd);
    module[cmd](args);
    return;
}

if (require.main == module.id) {
    // call main, stripping the module location from args
    main(system.args.splice(1));
}