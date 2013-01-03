var log = require("ringo/logging").getLogger(module.id);
var fs = require("fs");
var {ByteArray} = require("binary");
var {FileOutputStream, BufferedOutputStream, BufferedInputStream} = java.io;
var {ZipInputStream, ZipOutputStream, ZipEntry} = java.util.zip;
var {MemoryStream} = require("io");

var EXCLUDE_RE = /^(?:\.git|\.svn|\.hg|CVS|\.DS_Store)$/;

var filterEntries = function(dir, base) {
    var entries = [];
    base = base || "";
    for each (let name in fs.list(dir)) {
        if (EXCLUDE_RE.test(name)) {
            continue;
        }
        var path = fs.join(dir, name);
        var relPath = fs.join(base, name);
        if (fs.isDirectory(path)) {
            Array.prototype.push.apply(entries,
                    filterEntries(path, relPath));
        } else if (!fs.isLink(path)) {
            entries.push(relPath);
        }
    }
    return entries;
};

exports.createArchive = function(dir, dest) {
    var zipOutStream = null;
    try {
        var fileOutStream = new FileOutputStream(dest);
        zipOutStream = new ZipOutputStream(new BufferedOutputStream(fileOutStream));
        zipOutStream.setMethod(ZipOutputStream.DEFLATED);
        zipOutStream.setLevel(9);
        var entries = filterEntries(dir);
        for each (var path in entries) {
            var filePath = fs.join(dir, path);
            log.debug("Adding", filePath, "to archive at", path);
            var entry = new ZipEntry(path);
            entry.setTime(fs.lastModified(filePath));
            zipOutStream.putNextEntry(entry);
            fs.openRaw(filePath).copy(zipOutStream).close();
        }
        zipOutStream.flush();
    } finally {
        if (zipOutStream != null) {
            zipOutStream.close();
        }
    }
};

exports.extractArchive = function(archivePath, destPath) {
    var stream = fs.openRaw(archivePath);
    exports.extractStream(stream, destPath);
    stream.close();
};

exports.extractStream = function(stream, directory) {
    var inStream = null;
    try {
        var zipInStream = new ZipInputStream(new BufferedInputStream(stream));
        inStream = new Stream(zipInStream);
        var entry;
        while ((entry = zipInStream.getNextEntry()) !== null) {
            let path = fs.join(directory, entry.getName());
            if (entry.isDirectory()) {
                fs.makeDirectory(path);
            } else {
                log.debug("Extracted " + path);
                let parent = fs.directory(path);
                if (!fs.isDirectory(parent)) {
                     fs.makeTree(parent);
                }
                let destStream = fs.openRaw(path, {"write": true});
                inStream.copy(destStream);
                destStream.close();
            }
            if (entry.getTime() > -1) {
                fs.touch(path, entry.getTime());
            }
        }
    } finally {
        if (inStream != null) {
            inStream.close();
        }
    }
};

/**
 * Extracts a single file from a zip archive
 * @param {String} file The path to the zip archive
 * @param {String} path The path of the file in the zip archive to extract
 * @returns {ByteArray} A byte array containing the extracted file
 */
exports.extractFile = function(file, path) {
    var outStream = new MemoryStream();
    var zipInStream = null;
    var inStream = null;
    try {
        zipInStream = new ZipInputStream(new BufferedInputStream(fs.openRaw(file)));
        var entry;
        while ((entry = zipInStream.getNextEntry()) !== null) {
            if (entry.getName().equals(path)) {
                inStream = new Stream(zipInStream);
                inStream.copy(outStream);
                break;
            }
        }
        return outStream.content;
    } finally {
        if (zipInStream !== null) {
            zipInStream.close();
        }
        if (inStream != null) {
            inStream.close();
        }
        outStream.close();
    }
};
