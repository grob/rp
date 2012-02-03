var {Parser} = require("ringo/args");
var term = require("ringo/term");
var fs = require("fs");
var shell = require("ringo/shell");
var semver = require("../utils/semver");
var files = require("ringo/utils/files");
var strings = require("ringo/utils/strings");
var compress = require("../utils/compress");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");
var descriptors = require("../utils/descriptors");

var parser = new Parser();
parser.addOption("f", "force", null, "Force re-publishing of an already published package");

exports.description = "Publishes a package";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp publish [options] <directory>\n");
    return;
};

exports.publish = function(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }
    var dirPath = fs.absolute(args.shift() || ".");
    var descriptorPath = fs.join(dirPath, "package.json");
    if (!fs.exists(descriptorPath)) {
        term.writeln(term.RED, "No package.json file found in", dirPath, term.RESET);
        return;
    }
    // parse and evaluate package descriptor
    var descriptor = JSON.parse(fs.read(descriptorPath));
    descriptors.check(descriptor);
    descriptors.sanitize(descriptor);
    if (!opts.force && registry.exists(descriptor.name, descriptor.version)) {
        term.writeln("Version", descriptor.version, "of", descriptor.name,
                "has already been published. Use -f or --force to force re-publishing.");
        return;
    }
    var salt = null;
    var username, salt;
    while (!username || !salt) {
        username = shell.readln("Username: ").trim();
        if (username.length > 0) {
            salt = registry.getSalt(username);
            if (salt === null) {
                term.writeln(term.RED, "Unknown user", username, term.RESET);
            }
        }
    }
    var digest = crypto.createDigest(shell.readln("Password: ", "*"),
            strings.b64decode(salt, "raw"));
    var password = strings.b64encode(digest);
    var archivePath = files.createTempFile("publish", ".zip");
    try {
        compress.createArchive(dirPath, archivePath);
        var response = registry.publish(username, password, descriptor,
                new fs.Path(archivePath), opts.force);
        term.writeln(term.GREEN, response.message, term.RESET);
    } finally {
        if (archivePath !== null && fs.exists(archivePath)) {
            fs.remove(archivePath);
        }
    }
    return;
};
