var {Server} = org.eclipse.jetty.server;
var {JsgiServlet} = org.ringojs.jsgi
var {ServletHandler, ServletHolder, ServletContextHandler} = org.eclipse.jetty.servlet
var {SocketConnector} = org.eclipse.jetty.server.bio;
var {ContextHandlerCollection} = org.eclipse.jetty.server.handler;
var {LogManager, Level} = org.apache.log4j;
var engine = require('ringo/engine');

var WebServer = exports.WebServer = function(app, port) {

    port || (port = 8080);

    var server = new Server();
    var connector = new SocketConnector();
    connector.setPort(port);
    connector.setRequestHeaderSize(8192);
    server.addConnector(connector);

    var servlet = new JsgiServlet(engine.getRhinoEngine(), app);
    var holder = new ServletHolder(servlet);

    var contexts = new ContextHandlerCollection();
    var root = new ServletContextHandler(contexts, "/", ServletContextHandler.SESSIONS);
    root.addServlet(holder, "/*");

    server.setHandler(contexts);

    Object.defineProperties(this, {
        "server": {
            "value": server
        },
        "port": {
            "value": port
        },
        "app": {
            "value": app
        }
    });

    return this;
};

WebServer.prototype.start = function() {
    // disable jetty logging
    LogManager.getLogger("org.eclipse.jetty").setLevel(Level.OFF);
    this.server.start();
};

WebServer.prototype.stop = function() {
    this.server.stop();
};

WebServer.prototype.getUrl = function() {
    var ip = java.net.InetAddress.getLocalHost().getHostAddress();
    return "http://" + ip + ":" + this.port + "/";
};
