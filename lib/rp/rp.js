var term = require("ringo/term");
var config = require("./utils/config");
var logging = require("ringo/logging");

// set system property "rp.home" to config directory, it's used
// in log4j configuration (debug.log is stored in there)
java.lang.System.setProperty("rp.home", config.directory);
logging.setConfig(getResource("./log4j.properties"));

var log = logging.getLogger(module.id);

function main(args) {
    var cmd = args.shift() || "help";
    var cmdModule = null;
    try {
        cmdModule = require("./commands/" + cmd);
        cmdModule[cmd](args);
    } catch (e if e instanceof InternalError) {
        term.writeln(term.RED, "Unknown command '" + cmd +
                "', use 'help' to get a list of available commands",
                term.RESET);
        return false;
    } catch (e) {
        log.debug(e);
        term.writeln(term.RED, e.message, term.RESET);
    }
    return true;
}

if (require.main == module.id) {
    // call main, stripping the module location from args
    main(system.args.splice(1));
}