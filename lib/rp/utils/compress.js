var log = require("ringo/logging").getLogger(module.id);
var fs = require("fs");
var {ByteArray} = require("binary");
var {FileOutputStream, BufferedOutputStream} = java.io;
var {ZipInputStream, ZipOutputStream, ZipEntry} = java.util.zip;

export("createArchive", "createArchiveStream", "extractArchive", "extractStream");

var createArchive = function(dir, dest) {
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

var extractArchive = function(archivePath, destPath) {
    extractStream(fs.openRaw(archivePath), destPath);
    return;
};

var extractStream = function(stream, directory) {
    var inStream = null;
    try {
        var zipInStream = new ZipInputStream(stream);
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
