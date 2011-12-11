var term = require("ringo/term");
var shell = require("ringo/shell");
var fs = require("fs");
var conf = require("../utils/config");

exports.help = function help() {
    term.writeln("\nConfigure RingoJS package management client.\n");
    term.writeln("Usage:");
    term.writeln("  rp config");
    return true;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  config", term.RESET, "-", "Configure RingoJS package management client");
    return true;
};

exports.config = function config() {
    var baseDir, registryUrl;
    while (!baseDir) {
        baseDir = shell.readln("\nRingoJS installation directory (" +
                conf.baseDir + "): ").trim();
        if (!baseDir) {
            baseDir = conf.baseDir;
        }
        if (!fs.exists(baseDir)) {
            term.writeln(term.RED, "Directory", baseDir, "doesn't exist");
            baseDir = null;
        }
    }
    while (!registryUrl) {
        var prompt = "\nThe URL of the package repository";
        if (conf.registryUrl != undefined) {
            prompt += " (" + conf.registryUrl + ")";
        }
        registryUrl = shell.readln(prompt + ": ").trim();
        if (!registryUrl && conf.registryUrl) {
            registryUrl = conf.registryUrl;
        }
    }
    conf.write({
        "baseDir": baseDir,
        "registryUrl": registryUrl
    });
    term.writeln("\nWrote configuration to", conf.file);
};
