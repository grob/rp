var log = require("ringo/logging").getLogger(module.id);
var fs = require("fs");
var {ByteArray} = require("binary");
var {FileOutputStream, BufferedOutputStream, BufferedInputStream} = java.io;
var {ZipInputStream, ZipOutputStream, ZipEntry} = java.util.zip;
var {MemoryStream} = require("io");
var files = require("./files");

exports.createArchive = function(dir, dest) {
    var zipOutStream = null;
    try {
        var fileOutStream = new FileOutputStream(dest);
        zipOutStream = new ZipOutputStream(new BufferedOutputStream(fileOutStream));
        zipOutStream.setMethod(ZipOutputStream.DEFLATED);
        zipOutStream.setLevel(9);
        var tree = fs.listTree(dir);
        for each (var path in tree) {
            if (path.length < 1 || path.charAt(0) === ".") {
                continue;
            }
            var filePath = fs.join(dir, path);
            if (fs.isDirectory(filePath)) {
                continue;
            }
            log.debug("Adding", filePath, "to archive at", path);
            var entry = new ZipEntry(path);
            entry.setTime(fs.lastModified(filePath));
            zipOutStream.putNextEntry(entry);
            if (!fs.isDirectory(filePath)) {
                fs.openRaw(filePath).copy(zipOutStream).close();
            }
        }
        zipOutStream.flush();
    } finally {
        if (zipOutStream != null) {
            zipOutStream.close();
        }
    }
    return;
};

exports.extractArchive = function(archivePath, destPath) {
    extractStream(fs.openRaw(archivePath), destPath);
    return;
};

exports.extractStream = function(stream, directory) {
    var inStream = null;
    try {
        var zipInStream = new ZipInputStream(new BufferedInputStream(stream));
        inStream = new Stream(zipInStream);
        var entry;
        while ((entry = zipInStream.getNextEntry()) !== null) {
            var path = fs.join(directory, entry.getName());
            if (entry.isDirectory()) {
                fs.makeDirectory(path);
            } else {
                log.debug("Extracted " + path);
                var parent = fs.directory(path);
                if (!fs.isDirectory(parent)) {
                     fs.makeTree(parent);
                }
                inStream.copy(fs.openRaw(path, {write: true}));
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
    return;
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
