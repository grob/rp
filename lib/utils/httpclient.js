var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var files = require("ringo/utils/files");
var {MemoryStream} = require("io");
var {request, get, post, del, TextPart, BinaryPart} = require("ringo/httpclient");
var {KeyStore} = java.security;
var {TrustManagerFactory, SSLContext, HttpsURLConnection} = javax.net.ssl;
var {bytesToHex} = require("./bytes");

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
    log.debug("GET", url);
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
    log.debug("GET (binary)", url);
    var exchange = request({
        "url": url,
        "binary": true,
        "beforeSend": function(exchange) {
            if (exchange.connection instanceof HttpsURLConnection) {
                exchange.connection.setSSLSocketFactory(SSLFACTORY);
            }
        },
        "error": function(message, status, exchange) {
            throw new Error(message + ": " + exchange.connection.getURL());
        }
    });
    var tmpFile = files.createTempFile("rpkg-");
    fs.write(tmpFile, exchange.contentBytes, {
        "binary": true
    });
    log.debug("Stored binary file in", tmpFile);
    return tmpFile;
};

exports.post = function(url, data, username, password) {
    log.debug("POST", url);
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
    log.debug("DEL", url);
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
    log.debug("PUT", url);
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

