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
    var ringoHome, registryUrl;
    while (!ringoHome) {
        ringoHome = shell.readln("\nRingoJS installation directory (" +
                config.ringoHome + "): ").trim();
        if (!ringoHome) {
            ringoHome = config.ringoHome;
        } else if (!fs.exists(ringoHome)) {
            term.writeln(term.RED, "Directory", ringoHome, "doesn't exist");
            ringoHome = null;
        }
    }
    while (!registryUrl) {
        var prompt = "\nThe URL of the package repository";
        if (config.registryUrl != undefined) {
            prompt += " (" + config.registryUrl + ")";
        }
        registryUrl = shell.readln(prompt + ": ").trim();
        if (!registryUrl && config.registryUrl) {
            registryUrl = config.registryUrl;
        }
    }
    config.write({
        "ringoHome": ringoHome,
        "registryUrl": registryUrl
    });
    term.writeln(term.GREEN, "\nWrote configuration to", config.file, term.RESET);
};
