var fs = require("fs");
var files = require("ringo/utils/files");
var {MemoryStream} = require("io");
var {request, get, post, del, TextPart, BinaryPart} = require("ringo/httpclient");
var {KeyStore} = java.security;
var {TrustManagerFactory, SSLContext, HttpsURLConnection} = javax.net.ssl;

const RE_SLASH_LEADING = /^\//;
const RE_SLASH_TRAILING = /\/$/;

const TRUSTSTORE = (function() {
    var store = KeyStore.getInstance(KeyStore.getDefaultType());
    var inStream = fs.open(fs.join(module.directory, "truststore"), {
        "binary": true
    });
    try {
        store.load(inStream, new java.lang.String("nopassword").toCharArray());
    } finally {
        inStream.close();
    }
    return store;
})();

const SSLFACTORY = (function() {
    var tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    tmf.init(TRUSTSTORE);
    var ctx = SSLContext.getInstance("SSL");
    ctx.init(null, tmf.getTrustManagers(), null);
    return ctx.getSocketFactory();
})();

exports.get = function(url, parameters, headers) {
    var result = {
        "statusCode": null,
        "statusLine": null,
        "body": null
    };
    var exchange = request({
        "url": url,
        "headers": headers || {},
        "data": parameters,
        "beforeSend": function(exchange) {
            if (exchange.connection instanceof HttpsURLConnection) {
                exchange.connection.setSSLSocketFactory(SSLFACTORY);
            }
        }
    });
    result.statusCode = exchange.status;
    result.statusLine = exchange.message;
    if (exchange.content) {
        result.body = JSON.parse(exchange.content);
    }
    return result;
};

exports.getBinary = function(url) {
    var exchange = request({
        "url": url,
        "binary": true,
        "beforeSend": function(exchange) {
            if (exchange.connection instanceof HttpsURLConnection) {
                exchange.connection.setSSLSocketFactory(SSLFACTORY);
            }
        }
    });
    var checksums = {};
    var md5Digest = java.security.MessageDigest.getInstance("MD5");
    var sha1Digest = java.security.MessageDigest.getInstance("SHA-1");
    var sha256Digest = java.security.MessageDigest.getInstance("SHA-256");
    var fileStream, md5Stream, sha1Stream, sha256Stream;
    try {
        var tmpFile = files.createTempFile("rpkg-");
        fileStream = fs.open(tmpFile, {
            "write": true,
            "binary": true
        });
        md5Stream = new java.security.DigestOutputStream(fileStream, md5Digest);
        sha1Stream = new java.security.DigestOutputStream(md5Stream, sha1Digest);
        sha256Stream = new java.security.DigestOutputStream(sha1Stream, sha256Digest);
        (new MemoryStream(exchange.contentBytes)).copy(sha256Stream);
        checksums.md5 = bytesToHex(md5Digest.digest());
        checksums.sha1 = bytesToHex(sha1Digest.digest());
        checksums.sha256 = bytesToHex(sha256Digest.digest());
        return [tmpFile, checksums];
    } finally {
        for each (let stream in [fileStream, sha256Stream]) {
            if (stream != null) {
                stream.close();
            }
        }
    }
    return null;
};

exports.post = function(url, data, username, password) {
    var result = {
        "statusCode": null,
        "statusLine": null,
        "body": null
    };
    var parts = {};
    for (let [key, value] in Iterator(data)) {
        if (value instanceof fs.Path) {
            parts[key] = new BinaryPart(value.open({"binary": true}), fs.base(value));
        } else {
            parts[key] = new TextPart(value.toString(), "utf-8");
        }
    }
    var exchange = request({
        "url": url,
        "method": "POST",
        "contentType": "multipart/form-data",
        "data": parts,
        "username": username,
        "password": password,
        "beforeSend": function(exchange) {
            if (exchange.connection instanceof HttpsURLConnection) {
                exchange.connection.setSSLSocketFactory(SSLFACTORY);
            }
        }
    });
    result.statusCode = exchange.status;
    result.statusLine = exchange.message;
    if (exchange.content) {
        result.body = JSON.parse(exchange.content);
    }
    return result;
};

exports.del = function(url, username, password) {
    var exchange = request({
        "url": url,
        "method": "DELETE",
        "username": username,
        "password": password,
        "beforeSend": function(exchange) {
            if (exchange.connection instanceof HttpsURLConnection) {
                exchange.connection.setSSLSocketFactory(SSLFACTORY);
            }
        }
    });
    return {
        "statusCode": exchange.status,
        "statusLine": exchange.message,
        "body": JSON.parse(exchange.content)
    };
};

exports.put = function(url, username, password) {
    var exchange = request({
        "url": url,
        "method": "PUT",
        "username": username,
        "password": password,
        "beforeSend": function(exchange) {
            if (exchange.connection instanceof HttpsURLConnection) {
                exchange.connection.setSSLSocketFactory(SSLFACTORY);
            }
        }
    });
    return {
        "statusCode": exchange.status,
        "statusLine": exchange.message,
        "body": JSON.parse(exchange.content)
    };
};

exports.composeUrl = function composeUrl() {
    return Array.prototype.map.call(arguments, function(val, idx, arr) {
        val = val.replace(RE_SLASH_LEADING, "");
        if (idx < arr.length -1) {
            val = val.replace(RE_SLASH_TRAILING, "");
        }
        return val;
    }).join("/");
};

var bytesToHex = function(bytes) {
    var buf = new java.lang.StringBuffer(bytes.length * 2);
    for (let idx = 0; idx < bytes.length; idx += 1) {
        buf.append(java.lang.Integer.toString((bytes[idx] & 0xff) + 0x100, 16).substring(1));
    }
    return buf.toString();
};

