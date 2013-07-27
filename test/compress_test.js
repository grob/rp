var system = require("system");
var assert = require("assert");
var compress = require("../lib/utils/compress");
var fs = require("fs");
var files = require("ringo/utils/files");
var {ZipFile} = require("ringo/zip");

const tmpDir = fs.canonical(java.lang.System.getProperty("java.io.tmpdir"));
const testDir = fs.canonical(fs.join(tmpDir, "rptest"));

exports.setUp = function() {
    fs.makeTree(testDir);
};

exports.tearDown = function() {
    fs.removeTree(testDir);
};

exports.testCreateArchive = function() {
    var sourceZipPath = module.resolve("./testpackage.zip");
    var dir = fs.join(testDir, "extracted");
    fs.makeDirectory(dir);
    var destZipPath = fs.join(testDir, "testpackage.zip");
    compress.extractArchive(sourceZipPath, dir);
    // create some files/directories that are filtered out during archive creation
    for each (let name in [".git", ".svn", ".hg", "CVS"]) {
        let path = fs.join(dir, name);
        fs.makeDirectory(path);
        fs.touch(fs.join(path, "test"));
    }
    fs.touch(fs.join(dir, ".DS_Store"));
    compress.createArchive(dir, destZipPath);
    assert.isTrue(fs.exists(destZipPath));
    var sourceZip = new ZipFile(sourceZipPath);
    var destZip = new ZipFile(destZipPath);
    for each (let entry in destZip.entries) {
        assert.isTrue(sourceZip.entries.indexOf(entry) > -1);
        assert.strictEqual(destZip.getSize(entry), sourceZip.getSize(entry));
    }
    assert.isFalse(destZip.entries.some(function(entry) {
        return /(?:\.git|\.svn|\.hg|CVS|\.DS_Store)$/.test(entry);
    }));
};

exports.testExtractFile = function() {
    var zipPath = module.resolve("./testpackage.zip");
    var zip = new ZipFile(zipPath);
    var filePath = "lib/test.js";
    var bytes = compress.extractFile(zipPath, filePath);
    assert.isNotNull(bytes);
    assert.strictEqual(bytes.length, zip.getSize(filePath));
};

exports.testGetCommonPath = function() {
    var sourceZipPath = module.resolve("./testpackage.zip");
    var dir = fs.join(testDir, "test/package");
    fs.makeTree(dir);
    compress.extractArchive(sourceZipPath, dir);
    var destZipPath = fs.join(testDir, "archive.zip");
    compress.createArchive(dir, destZipPath);
    assert.isTrue(fs.exists(destZipPath));
    assert.strictEqual("", compress.getCommonPath(destZipPath));
    compress.createArchive(fs.join(testDir, "test"), destZipPath);
    assert.isTrue(fs.exists(destZipPath));
    assert.strictEqual("package/", compress.getCommonPath(destZipPath));
};

exports.testRelocateEntries = function() {
    var sourceZipPath = module.resolve("./testpackage.zip");
    var prefix = "package/test";
    var relocatedZipPath = compress.relocateEntries(sourceZipPath, function(entry) {
        return prefix + "/" + entry;
    });
    var relocatedZip = new ZipFile(relocatedZipPath);
    var entries = relocatedZip.entries;
    fs.remove(relocatedZipPath);
    assert.isTrue(entries.every(function(entry) {
        return entry.indexOf(prefix) === 0;
    }));
};


//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
