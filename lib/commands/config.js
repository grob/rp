var term = require("ringo/term");
var shell = require("ringo/shell");
var fs = require("fs");
var config = require("../utils/config");

exports.description = "Configure RingoJS package management client";

exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp config\n");
    return true;
};

exports.config = function() {
    var newConfig = {};
    var ringoHome = shell.readln("\nRingoJS installation directory (" +
            config.ringoHome + "): ").trim();
    if (!fs.exists(ringoHome)) {
        throw new Error("Directory " + ringoHome + " doesn't exist");
    } else if (ringoHome.length > 0) {
        newConfig.ringoHome = ringoHome;
    }
    var registryUrl = shell.readln("\nPackage repository URL (" +
            config.registryUrl + "): ").trim();
    if (registryUrl.length > 0) {
        newConfig.registryUrl = registryUrl;
    }
    config.write(newConfig);
    term.writeln(term.GREEN, "\nWrote configuration to", config.file, term.RESET);
};
