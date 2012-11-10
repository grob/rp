var strings = require("ringo/utils/strings");

exports.indent = function(/* (str, level, char) or (level, char) or (str, level) or (level) */) {
    var str, level, char;
    if (arguments.length === 3) {
        [str, level, char] = arguments;
    } else if (arguments.length === 2) {
        if (typeof(arguments[0]) === "number") {
            [level, char] = arguments;
        } else {
            [str, level] = arguments;
        }
    } else {
        level = arguments[0];
    }
    return strings.repeat(char || " ", (level || 0) * 3) + (str || "");
};