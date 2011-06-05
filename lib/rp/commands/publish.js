var log = require("ringo/logging").getLogger(module.id);
var {Parser} = require("ringo/args");
var term = require("ringo/term");
var fs = require("fs");
var io = require("io");
var binary = require("binary");
var shell = require("ringo/shell");
var semver = require("ringo-semver");
var files = require("ringo/utils/files");
var strings = require("ringo/utils/strings");
var config = require("../config");
var httpclient = require("../utils/httpclient");
var compress = require("../utils/compress");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");

var parser = new Parser();
parser.addOption("f", "force", null, "Force re-publishing of an already published package");

exports.help = function help() {
    term.writeln("\nPublishes a package.\n");
    term.writeln("Usage:");
    term.writeln("  rp publish [options] <directory>");
    return;
};

exports.info = function info() {
    term.writeln(term.BOLD, "  publish", term.RESET, "-", "Publishes a package");
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
    var dirPath = fs.absolute(args.shift());
    var descriptorPath = fs.join(dirPath, "package.json");
    if (!fs.exists(descriptorPath)) {
        term.writeln(term.RED, "No package.json file found in", dirPath, term.RESET);
        return;
    }
    // parse and evaluate package descriptor
    var descriptor = null;
    try {
        descriptor = evalPackageDescriptor(JSON.parse(fs.read(descriptorPath)));
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        return;
    }
    if (!opts.force && registry.exists(descriptor.name, descriptor.version)) {
        term.writeln("Version", descriptor.version, "of", descriptor.name,
                "has already been published. Use -f or --force to force re-publishing.");
        return;
    }
    var salt = null;
    var username, salt;
    while (!username || !salt) {
        username = shell.readln("Username: ");
        salt = registry.getSalt(username);
        if (!salt) {
            term.writeln(term.RED, "Unknown user", username, term.RESET);
        }
    }
    var digest = crypto.createDigest(shell.readln("Password: ", "*"),
            strings.b64decode(salt, "raw"));
    var password = strings.b64encode(digest);
    var archivePath = files.createTempFile("publish", ".tgz");
    try {
        compress.createArchive(dirPath, archivePath);
        var response = registry.publish(username, password, descriptor,
                new fs.Path(archivePath), opts.force);
        if (response === null) {
            print(term.RED, "Unable to contact registry, please try again later", term.RESET);
        } else {
            term.writeln(term.GREEN, JSON.parse(response).message, term.RESET);
        }
    } finally {
        if (archivePath !== null && fs.exists(archivePath)) {
            fs.remove(archivePath);
        }
    }
    return;
};

var evalPackageDescriptor = function(descriptor) {
    // some package descriptor sanity checks
    if (/[^a-z0-9._\- ]/.test(descriptor.name)) {
        throw new Error("The package name may only contain lowercase alphanumeric characters and '.', '_' or '-'");
    }
    if (!descriptor.description) {
        throw new Error("The package descriptor field 'description' is missing");
    }
    /*
    ["keywords", "maintainers", "contributors"].forEach(function(key) {
        var value = descriptor[key];
        if (!(value instanceof Array) || value.length < 1) {
            throw new Error("The package descriptor field '" + key + "' is missing or empty");
        }
    });
    */

    // clean version and expand to a fully semantic version string
    descriptor.version = semver.cleanVersion(descriptor.version);
    return descriptor;
}