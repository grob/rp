var shell = require("ringo/shell");
var log = require("ringo/logging").getLogger(module.id);

exports.confirm = function(message, keys, defaultKey) {
    var accepted = keys.map(function(key) {
        return key[(key === defaultKey) ? "toUpperCase" : "toLowerCase"]();
    }).join("/");
    var value;
    do {
        value = shell.readln(message + " (" + accepted + ") ").toLowerCase() ||
                defaultKey;
    } while (keys.indexOf(value) < 0);
    log.debug("Confirm:", value.toLowerCase());
    return value.toLowerCase();
};

exports.proceed = function(defaultKey) {
    return exports.confirm("\nDo you want to continue?", ["y", "n"], defaultKey) === "y";
};
